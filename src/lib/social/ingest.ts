// ─────────────────────────────────────────────────────────────────────────────
// Social ingest service — the single entry point every source feeds through
// (replay corpus, the in-app demo button, or a future live connector).
//
//   raw post ──▶ NLP classification (LLM + heuristic fallback)
//             ──▶ gazetteer geocoding (place mentions → lat/lon)
//             ──▶ corroboration clustering + composite trust score
//             ──▶ SQLite (always) + Supabase mirror (when configured)
//
// Ground-truth `labels` from corpus entries are accepted but deliberately
// ignored here — they exist only for the offline evaluation script.

import { createHash } from "crypto";
import { db } from "@/lib/db";
import { dualWrite } from "@/lib/report-server";
import { classifyPosts, type ClassifyInput } from "@/lib/social/classify";
import { geocodePost } from "@/lib/social/gazetteer";
import { computeTrust, findCluster, refreshClusterTrust, type AuthorMeta, type SocialPostRow } from "@/lib/social/trust";
import { absorbIntoReports } from "@/lib/social/reports";

export type RawSocialPost = {
  id?: string;
  source?: string;
  handle?: string;
  author?: { handle?: string; accountAgeDays?: number; followers?: number; verified?: boolean };
  text?: string;
  postedAt?: string;
  geo?: { lat?: number; lon?: number } | null;
  scenario?: string;
  labels?: unknown; // ground truth — never used by the pipeline itself
};

export type IngestedPost = {
  externalId: string;
  dbId?: string;
  duplicate?: boolean;
  isMobility: boolean;
  eventType: string | null;
  severity: string | null;
  sentiment: string | null;
  placeLabel: string | null;
  lat: number | null;
  lon: number | null;
  trustScore: number | null;
  verification: string | null;
  corroborates: number;
  engine: string;
};

function externalIdFor(p: RawSocialPost, postedAt: Date): string {
  if (p.id) return String(p.id);
  const basis = `${p.source ?? "other"}|${p.handle ?? p.author?.handle ?? ""}|${p.text ?? ""}|${postedAt.toISOString()}`;
  return `auto-${createHash("sha1").update(basis).digest("hex").slice(0, 20)}`;
}

export async function ingestPosts(rawPosts: RawSocialPost[], opts: { timeScale?: number } = {}): Promise<{ results: IngestedPost[]; inserted: number; duplicates: number }> {
  const timeScale = Math.max(1, Math.min(1000, opts.timeScale ?? 1));
  const results: IngestedPost[] = [];
  let inserted = 0;
  let duplicates = 0;

  // 1) validate + dedupe against DB
  const valid: Array<{ raw: RawSocialPost; externalId: string; postedAt: Date }> = [];
  for (const raw of rawPosts) {
    const text = (raw.text ?? "").trim();
    if (!text) continue;
    const postedAt = raw.postedAt ? new Date(raw.postedAt) : new Date();
    if (Number.isNaN(postedAt.getTime())) continue;
    const externalId = externalIdFor(raw, postedAt);
    const exists = await db.socialPost.findUnique({ where: { externalId } }).catch(() => null);
    if (exists) {
      duplicates++;
      results.push({
        externalId,
        dbId: exists.id,
        duplicate: true,
        isMobility: exists.isMobility,
        eventType: exists.eventType,
        severity: exists.severity,
        sentiment: exists.sentiment,
        placeLabel: exists.placeLabel,
        lat: exists.lat,
        lon: exists.lon,
        trustScore: exists.trustScore,
        verification: exists.verification,
        corroborates: exists.corroborates,
        engine: "cached",
      });
      continue;
    }
    valid.push({ raw, externalId, postedAt });
  }

  if (valid.length === 0) return { results, inserted, duplicates };

  // 2) NLP classification (single LLM batch for the whole request)
  const inputs: ClassifyInput[] = valid.map((v) => ({
    id: v.externalId,
    text: v.raw.text ?? "",
    source: v.raw.source,
  }));
  const classified = await classifyPosts(inputs);

  // 3) geocode + trust + persist (in order, so corroboration grows naturally)
  for (const { raw, externalId, postedAt } of valid) {
    const cls = classified.get(externalId);
    const text = raw.text ?? "";
    const geo = geocodePost(text, cls?.locations ?? []);
    // explicit GPS (rare) beats gazetteer resolution
    const lat = raw.geo?.lat ?? geo.primary?.lat ?? null;
    const lon = raw.geo?.lon ?? geo.primary?.lon ?? null;
    const placeLabel = geo.primary?.name ?? (raw.geo ? "GPS location" : null);

    const authorMeta: AuthorMeta | null = raw.author
      ? {
          accountAgeDays: raw.author.accountAgeDays,
          followers: raw.author.followers,
          verified: raw.author.verified,
        }
      : null;

    // initial trust against the cluster state BEFORE this insert
    const neighbors = lat != null && lon != null && cls?.isMobility
      ? await findCluster({
          eventType: cls.eventType,
          lat,
          lon,
          postedAt,
          timeScale,
        })
      : [];
    const { score, verification, breakdown } = computeTrust({
      source: raw.source ?? "other",
      authorMeta,
      text,
      resolvedLocation: placeLabel != null,
      outOfRegion: geo.outOfRegion,
      hasTimeRef: (cls?.timeRefs?.length ?? 0) > 0,
      neighbors: neighbors.map((n) => ({ authorHandle: n.authorHandle, source: n.source })),
    });

    const nlpMeta = JSON.stringify({
      engine: cls?.engine ?? "heuristic",
      locationsExtracted: cls?.locations ?? [],
      timeRefs: cls?.timeRefs ?? [],
      outOfRegion: geo.outOfRegion,
      hasTimeRef: (cls?.timeRefs?.length ?? 0) > 0,
      matchedPlaces: geo.matches.map((m) => m.name),
      trust: breakdown,
    });

    const { local } = await dualWrite<unknown & { id: string }>("socialPost", "social_posts", {
      externalId,
      source: raw.source ?? "other",
      authorHandle: raw.handle ?? raw.author?.handle ?? null,
      authorMeta: authorMeta ? JSON.stringify(authorMeta) : null,
      text,
      postedAt,
      isMobility: cls?.isMobility ?? false,
      eventType: cls?.isMobility ? cls.eventType : null,
      severity: cls?.isMobility ? cls.severity : null,
      sentiment: cls?.isMobility ? cls.sentiment : null,
      summary: cls?.isMobility ? cls.summary : null,
      lat,
      lon,
      placeLabel,
      matchedPlaces: JSON.stringify(geo.matches.map((m) => ({ name: m.name, kind: m.kind }))),
      trustScore: score,
      verification,
      corroborates: 0,
      nlpMeta,
      scenario: raw.scenario ?? null,
      timeScale,
    });

    inserted++;
    results.push({
      externalId,
      dbId: local.row.id,
      isMobility: cls?.isMobility ?? false,
      eventType: cls?.isMobility ? cls.eventType : null,
      severity: cls?.isMobility ? cls.severity : null,
      sentiment: cls?.isMobility ? cls.sentiment : null,
      placeLabel,
      lat,
      lon,
      trustScore: score,
      verification,
      corroborates: 0,
      engine: cls?.engine ?? "heuristic",
    });
  }

  // 4) refresh trust across affected clusters (new evidence strengthens old reports)
  for (const r of results) {
    if (r.duplicate || !r.dbId) continue;
    const row = (await db.socialPost.findUnique({ where: { id: r.dbId } }).catch(() => null)) as unknown as SocialPostRow | null;
    if (row && row.lat != null && row.lon != null && row.eventType) {
      await refreshClusterTrust(row).catch(() => undefined);
    }
  }

  // 5) read back final trust values for the response
  for (const r of results) {
    if (r.duplicate || !r.dbId) continue;
    const row = (await db.socialPost.findUnique({ where: { id: r.dbId } }).catch(() => null)) as unknown as SocialPostRow | null;
    if (row) {
      r.trustScore = row.trustScore;
      r.verification = row.verification;
      r.corroborates = row.corroborates;
    }
  }

  // 6) feed each new post into the incident-report builder (report popup in
  //    the admin console + geo-targeted citizen notification). Runs in the
  //    background so the ingest response stays fast.
  for (const r of results) {
    if (r.duplicate || !r.dbId) continue;
    const row = (await db.socialPost.findUnique({ where: { id: r.dbId } }).catch(() => null)) as unknown as SocialPostRow | null;
    if (row) {
      void absorbIntoReports(row as unknown as Parameters<typeof absorbIntoReports>[0]).catch((e) => {
        console.error("[reports] absorb failed:", e instanceof Error ? e.message : e);
      });
    }
  }

  return { results, inserted, duplicates };
}
