// ─────────────────────────────────────────────────────────────────────────────
// Incident-report builder — turns the classified social stream into the
// actionable objects the product is about:
//
//   posts (NLP-classified, geocoded, trust-scored)
//     ──▶ cluster by place + event type + time into ONE IncidentReport
//     ──▶ LLM-summarise the report (title + operational summary)
//     ──▶ build a commuter advisory (MTC buses via <place> delayed → use
//          Metro where it actually serves the area, else other options)
//     ──▶ push a geo-targeted UserNotification (users NEAR the incident
//          receive it; radius grows with severity)
//
//   admin resolves the report ─▶ "all clear" notification to the same area.
//
// Everything is source-agnostic: the input is whatever /api/social/ingest
// accepted (replay corpus today, a live connector tomorrow).

import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { dualWrite } from "@/lib/report-server";
import { GAZETTEER, distanceKm } from "@/lib/social/gazetteer";
import type { Advisory } from "@/lib/alerts";

// ── constants ────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const VERIF_RANK: Record<string, number> = { flagged: 0, unverified: 1, verified: 2 };

/** notification radius per severity (km) */
export const SEVERITY_RADIUS: Record<string, number> = { low: 3, medium: 5, high: 8, critical: 12 };

const REPORT_CLUSTER_KM = 2.5;
/** how long (scenario minutes) an open report keeps absorbing new posts */
const REPORT_WINDOW_MIN = 90;

const EVENT_LABEL: Record<string, string> = {
  congestion: "Heavy traffic",
  accident: "Road accident",
  flood: "Waterlogging",
  transit_disruption: "Transit disruption",
  road_closure: "Road closure",
  infrastructure: "Infrastructure fault",
  protest: "Protest",
  hazard: "Hazard",
  other: "Incident",
};

/** MTC corridors that serve each area (route numbers as defined in this
 *  prototype's transit data — e.g. 578: CMBT–Porur–Mount Poonamallee–
 *  Poonamallee–Sriperumbudur). */
const CORRIDOR_ROUTES: Array<{ re: RegExp; label: string; routes: string }> = [
  { re: /poonamallee/i, label: "Poonamallee", routes: "54, S26, 578" },
  { re: /mount.?poonamallee|porur|ramapuram|valasaravakkam|iyappanthangal/i, label: "Mount–Poonamallee Road", routes: "S26, 54, 578" },
  { re: /omr|perungudi|thoraipakkam|sholinganallur|taramani|karapakkam|navalur|siruseri|old mahabalipuram/i, label: "OMR corridor", routes: "570, 578" },
  { re: /kathipara|gst|meenambakkam|pallavaram|chromepet|tambaram|airport/i, label: "GST Road corridor", routes: "18A, 70, 88C" },
  { re: /anna salai|mount road|t nagar|guindy|saidapet|teynampet|nandanam/i, label: "Anna Salai corridor", routes: "23C, 45B, 51" },
  { re: /cmbt|koyambedu|ambattur|padi|anna nagar|maduravoyal/i, label: "CMBT–Padi corridor", routes: "15L, 24C" },
  { re: /ecr|besant nagar|thiruvanmiyur|neelankarai|palavakkam|adyar/i, label: "ECR corridor", routes: "19, 19A" },
  { re: /velachery|madipakkam|pallikaranai|medavakkam|perumbakkam/i, label: "Velachery corridor", routes: "1B, 21L" },
];

const METRO_ENTRIES = GAZETTEER.filter((g) => g.kind === "metro");

/** nearest operational Chennai Metro stations to a point. */
export function nearestMetro(lat: number, lon: number, n = 2): Array<{ name: string; km: number }> {
  return METRO_ENTRIES
    .map((m) => ({ name: m.name.replace(" Metro", ""), km: Math.round(distanceKm({ lat, lon }, m) * 10) / 10 }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

function corridorFor(placeLabel: string): { label: string; routes: string } | null {
  return CORRIDOR_ROUTES.find((c) => c.re.test(placeLabel)) ?? null;
}

// ── advisory ─────────────────────────────────────────────────────────────────

/**
 * Deterministic, explainable commuter advice. The example the product brief
 * gives: a report in Poonamallee → users near Poonamallee are told MTC buses
 * through that area will be slow, so use the Metro where it is available, or
 * other transport options.
 */
export function buildAdvisory(input: {
  eventType: string;
  severity: string;
  placeLabel: string;
  lat: number;
  lon: number;
}): Advisory {
  const { eventType, severity, placeLabel, lat, lon } = input;
  const metro = nearestMetro(lat, lon, 2);
  const metroAvailable = (metro[0]?.km ?? Infinity) <= 4.5;
  const corridor = corridorFor(placeLabel);
  const label = EVENT_LABEL[eventType] ?? "Incident";
  const place = placeLabel.replace(/ \(.*\)$/, "");

  // …what it means for MTC buses through the area
  let busNote: string;
  if (eventType === "transit_disruption") {
    busNote = `Trains/services through ${place} are affected; MTC feeder buses and share autos near the stations are seeing rush crowds.`;
  } else if (eventType === "road_closure") {
    busNote = `MTC buses${corridor ? ` on the ${corridor.label} (${corridor.routes})` : ` via ${place}`} are diverted — expect longer routes and delays.`;
  } else {
    busNote = `MTC buses${corridor ? ` on the ${corridor.label} (${corridor.routes})` : ` via ${place}`} may be delayed or slowed by this.`;
  }

  // …the Metro alternative (only where the Metro actually serves the area)
  let metroNote: string;
  if (eventType === "transit_disruption") {
    metroNote = `This affects the Metro itself — switch to MTC buses or suburban trains for this stretch.`;
  } else if (metroAvailable) {
    const first = metro[0];
    const second = metro[1];
    metroNote = `Chennai Metro is a faster option nearby: board at ${first.name} (${first.km} km away)${second ? ` or ${second.name} (${second.km} km)` : ""} and skip the surface traffic.`;
  } else if (metro[0]) {
    metroNote = `The Metro does not serve this stretch yet — the nearest stations are ${metro
      .map((m) => `${m.name} (~${m.km} km)`)
      .join(", ")}. If your route allows, combine a short cab/auto hop with the Metro; otherwise use alternate roads and transport options.`;
  } else {
    metroNote = `Consider autos, cabs (Ola/Uber/Rapido) or alternate roads via ${place}.`;
  }

  // …general guidance
  const extra =
    severity === "critical"
      ? `Avoid the area entirely until authorities clear it. Allow extra time or postpone the trip.`
      : severity === "high"
        ? `Budget 20–40 extra minutes if you must travel through ${place}; check live updates before you leave.`
        : `Keep a few minutes of buffer; conditions can change quickly.`;

  const headline = `${label} near ${place} — buses via this stretch may be affected`;
  return { headline, busNote, metroNote, extra, metro, metroAvailable };
}

// ── LLM summarisation ────────────────────────────────────────────────────────

const REPORT_SYSTEM_PROMPT = `You write incident reports for a city transit-operations console in Chennai, India.
Given a set of citizen social posts about ONE transport incident, return strict JSON (no markdown) with:
- "title": a short headline, max 8 words, format "<What> at/near <Place>" (e.g. "Waterlogging at Poonamallee Bypass")
- "summary": 2-3 neutral sentences (max 55 words) for duty officers: what happened, current impact on traffic/transit, any response underway. Only use facts present in the posts. No advice, no emojis.`;

export type ReportDigest = { title: string; summary: string };

/** Heuristic digest — used when the LLM is unavailable. */
function heuristicDigest(posts: Array<{ text: string; place: string | null }>, eventType: string, placeLabel: string): ReportDigest {
  const label = EVENT_LABEL[eventType] ?? "Incident";
  const place = placeLabel.replace(/ \(.*\)$/, "");
  const first = posts[0]?.text.replace(/\s+/g, " ").slice(0, 110) ?? "";
  return {
    title: `${label} at ${place}`,
    summary: `${label} reported near ${place}. ${posts.length} citizen report${posts.length > 1 ? "s" : ""} in the last few minutes. ${first}${first.endsWith(".") ? "" : "."} Commuters describe delays around the stretch; MTC services through the area may run behind schedule.`,
  };
}

async function llmDigest(
  posts: Array<{ text: string; handle: string | null; source: string }>,
  eventType: string,
  placeLabel: string,
): Promise<ReportDigest | null> {
  try {
    const zai = await ZAI.create();
    const userMsg = `Event type: ${eventType}\nResolved place: ${placeLabel}\nPosts (oldest first):\n${posts
      .map((p, i) => `#${i + 1} [@${p.handle ?? p.source}] ${p.text.replace(/\s+/g, " ").slice(0, 400)}`)
      .join("\n")}`;
    const completion = (await Promise.race([
      zai.chat.completions.create({
        messages: [
          { role: "assistant", content: REPORT_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        thinking: { type: "disabled" },
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("llm timeout")), 30_000)),
    ])) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = completion.choices?.[0]?.message?.content ?? "";
    let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    const parsed = JSON.parse(s) as { title?: string; summary?: string };
    const title = String(parsed.title ?? "").trim().slice(0, 90);
    const summary = String(parsed.summary ?? "").trim().slice(0, 600);
    if (!title || !summary) return null;
    return { title, summary };
  } catch {
    return null;
  }
}

// ── notification helper ──────────────────────────────────────────────────────

async function pushNotification(input: {
  reportId: string;
  code: string;
  kind: "incident" | "escalation" | "cleared";
  areaLabel: string;
  lat: number;
  lon: number;
  radiusKm: number;
  headline: string;
  body: string;
  meta: Record<string, unknown>;
}): Promise<void> {
  const { local } = await dualWrite<unknown & { id: string }>("userNotification", "user_notifications", {
    reportId: input.reportId,
    code: input.code,
    kind: input.kind,
    areaLabel: input.areaLabel,
    lat: input.lat,
    lon: input.lon,
    radiusKm: input.radiusKm,
    headline: input.headline,
    body: input.body,
    meta: JSON.stringify(input.meta),
  });
  void local;
  await db.incidentReport
    .update({ where: { id: input.reportId }, data: { notificationsSent: { increment: 1 } } })
    .catch(() => undefined);
}

// ── main entry point ─────────────────────────────────────────────────────────

export type ReportOutcome = {
  reportId: string;
  code: string;
  action: "created" | "updated" | "escalated" | "ignored";
  title: string;
};

type PostRow = {
  id: string;
  source: string;
  authorHandle: string | null;
  text: string;
  postedAt: Date;
  isMobility: boolean;
  eventType: string | null;
  severity: string | null;
  sentiment: string | null;
  summary: string | null;
  lat: number | null;
  lon: number | null;
  placeLabel: string | null;
  trustScore: number | null;
  verification: string | null;
  scenario: string | null;
  timeScale: number;
};

async function nextReportCode(): Promise<string> {
  const count = await db.incidentReport.count();
  return `RPT-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Feed ONE freshly ingested (and trust-refreshed) post into the report
 * builder. Called from the ingest pipeline after every insert.
 */
export async function absorbIntoReports(post: PostRow): Promise<ReportOutcome[]> {
  const outcomes: ReportOutcome[] = [];

  // rumours / non-mobility chatter / unlocatable posts never become reports
  if (!post.isMobility || !post.eventType || !post.severity) {
    return [{ reportId: "", code: "", action: "ignored", title: "" }];
  }
  if (post.lat == null || post.lon == null || !post.placeLabel) {
    return [{ reportId: "", code: "", action: "ignored", title: "" }];
  }
  if (post.verification === "flagged") {
    return [{ reportId: "", code: "", action: "ignored", title: "" }];
  }

  // ── 1) find an open report this post belongs to (same type, same place,
  //      recent in scenario time) ──────────────────────────────────────────
  const winMs = Math.max(4, REPORT_WINDOW_MIN / Math.max(1, post.timeScale)) * 60_000;
  const open = (await db.incidentReport.findMany({ where: { status: "open" }, take: 200 })) as unknown as Array<{
    id: string;
    code: string;
    eventType: string;
    severity: string;
    placeLabel: string;
    lat: number;
    lon: number;
    title: string;
    summary: string;
    advisory: string | null;
    postIds: string;
    postCount: number;
    maxTrust: number | null;
    verification: string | null;
    lastScenarioAt: Date;
  }>;

  const match = open.find(
    (r) =>
      r.eventType === post.eventType &&
      distanceKm({ lat: r.lat, lon: r.lon }, { lat: post.lat!, lon: post.lon! }) <= REPORT_CLUSTER_KM &&
      Math.abs(r.lastScenarioAt.getTime() - post.postedAt.getTime()) <= winMs,
  );

  const severity = post.severity;
  const trust = post.trustScore ?? 0;
  const verification = post.verification ?? "unverified";

  // ── 2a) update the existing report ─────────────────────────────────────
  if (match) {
    const escalated =
      (SEVERITY_RANK[severity] ?? 0) > (SEVERITY_RANK[match.severity] ?? 0) &&
      (SEVERITY_RANK[severity] ?? 0) >= 2;

    const ids: string[] = JSON.parse(match.postIds || "[]");
    if (!ids.includes(post.id)) ids.push(post.id);

    const newSeverity = (SEVERITY_RANK[severity] ?? 0) > (SEVERITY_RANK[match.severity] ?? 0) ? severity : match.severity;
    const newVerif = (VERIF_RANK[verification] ?? 0) > (VERIF_RANK[match.verification ?? "unverified"] ?? 0) ? verification : match.verification;

    await db.incidentReport.update({
      where: { id: match.id },
      data: {
        severity: newSeverity,
        verification: newVerif,
        maxTrust: Math.max(match.maxTrust ?? 0, trust),
        postCount: { increment: 1 },
        postIds: JSON.stringify(ids),
        lastScenarioAt: post.postedAt,
        lastActivityAt: new Date(),
      },
    });
    await db.socialPost.update({ where: { id: post.id }, data: { reportId: match.id } }).catch(() => undefined);

    if (escalated) {
      const advisory = buildAdvisory({ eventType: post.eventType, severity: newSeverity, placeLabel: match.placeLabel, lat: match.lat, lon: match.lon });
      await pushNotification({
        reportId: match.id,
        code: `${match.id}:escalation:${newSeverity}`,
        kind: "escalation",
        areaLabel: match.placeLabel,
        lat: match.lat,
        lon: match.lon,
        radiusKm: SEVERITY_RADIUS[newSeverity] ?? 5,
        headline: `Update: ${match.title} — severity now ${newSeverity}`,
        body: `More reports are coming in from ${match.placeLabel}. ${advisory.busNote} ${advisory.metroNote}`,
        meta: { eventType: post.eventType, severity: newSeverity, advisory },
      });
    }

    outcomes.push({ reportId: match.id, code: match.code, action: escalated ? "escalated" : "updated", title: match.title });
    return outcomes;
  }

  // ── 2b) create a NEW report ───────────────────────────────────────────
  const advisory = buildAdvisory({ eventType: post.eventType, severity, placeLabel: post.placeLabel, lat: post.lat, lon: post.lon });
  const digest = (await llmDigest([{ text: post.text, handle: post.authorHandle, source: post.source }], post.eventType, post.placeLabel)) ??
    heuristicDigest([{ text: post.text, place: post.placeLabel }], post.eventType, post.placeLabel);

  const code = await nextReportCode();
  const { local } = await dualWrite<unknown & { id: string; code: string; title: string }>("incidentReport", "incident_reports", {
    code,
    eventType: post.eventType,
    severity,
    placeLabel: post.placeLabel,
    lat: post.lat,
    lon: post.lon,
    title: digest.title,
    summary: digest.summary,
    advisory: JSON.stringify(advisory),
    status: "open",
    lastScenarioAt: post.postedAt,
    postCount: 1,
    maxTrust: trust,
    verification,
    scenario: post.scenario ?? null,
    postIds: JSON.stringify([post.id]),
  });
  const report = local.row;

  await db.socialPost.update({ where: { id: post.id }, data: { reportId: report.id } }).catch(() => undefined);

  await pushNotification({
    reportId: report.id,
    code: `${report.id}:incident`,
    kind: "incident",
    areaLabel: post.placeLabel,
    lat: post.lat,
    lon: post.lon,
    radiusKm: SEVERITY_RADIUS[severity] ?? 5,
    headline: `${digest.title} — buses via ${post.placeLabel.replace(/ \(.*\)$/, "")} may be affected`,
    body: `${digest.summary}\n\n${advisory.busNote} ${advisory.metroNote} ${advisory.extra}`,
    meta: { eventType: post.eventType, severity, advisory },
  });

  outcomes.push({ reportId: report.id, code: report.code, action: "created", title: report.title });
  return outcomes;
}

// ── admin actions ────────────────────────────────────────────────────────────

/** Resolve a report (admin) and push the "all clear" notification. */
export async function resolveReport(input: { reportId: string; note?: string; admin?: string }) {
  const report = await db.incidentReport.findUnique({ where: { id: input.reportId } });
  if (!report) return { ok: false as const, error: "report not found" };
  if (report.status === "resolved") return { ok: false as const, error: "already resolved" };

  const now = new Date();
  await db.incidentReport.update({
    where: { id: report.id },
    data: {
      status: "resolved",
      resolvedAt: now,
      resolvedBy: input.admin?.trim() || "CUMTA Control Room",
      resolutionNote: input.note?.trim() || null,
      lastActivityAt: now,
    },
  });

  const place = report.placeLabel.replace(/ \(.*\)$/, "");
  await pushNotification({
    reportId: report.id,
    code: `${report.id}:cleared`,
    kind: "cleared",
    areaLabel: report.placeLabel,
    lat: report.lat,
    lon: report.lon,
    radiusKm: SEVERITY_RADIUS[report.severity] ?? 5,
    headline: `All clear: ${report.title}`,
    body: `This issue near ${place} has been attended to by the authorities${input.note ? ` — ${input.note.trim()}` : ""}. Traffic and MTC services are returning to normal. ${report.eventType === "transit_disruption" ? "Metro services resumed." : "Metro unaffected throughout."} Thank you for your patience.`,
    meta: { eventType: report.eventType, severity: report.severity, advisory: null },
  });

  return { ok: true as const, reportId: report.id, code: report.code };
}
