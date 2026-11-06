import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/reports — incident reports for the admin console.
// ?status=open|resolved|all &limit=  &since=  (ISO — only reports with
// lastActivityAt newer; used for popup polling)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 100)));
  const since = url.searchParams.get("since");

  const where: Record<string, unknown> = {};
  if (status === "open" || status === "resolved") where.status = status;
  if (status === "flagged") where.verification = "flagged";
  if (since) {
    const d = new Date(since);
    if (!Number.isNaN(d.getTime())) where.lastActivityAt = { gt: d };
  }

  const [rows, openCount, resolvedCount, notifCount, flaggedCount] = await Promise.all([
    db.incidentReport.findMany({ where, orderBy: { lastActivityAt: "desc" }, take: limit }),
    db.incidentReport.count({ where: { status: "open" } }),
    db.incidentReport.count({ where: { status: "resolved" } }),
    db.userNotification.count(),
    db.incidentReport.count({ where: { verification: "flagged", status: "open" } }),
  ]);

  const postIdsToFetch: string[] = [];
  for (const r of rows) {
    try {
      const ids = JSON.parse(r.postIds || "[]") as string[];
      if (Array.isArray(ids) && ids[0]) postIdsToFetch.push(ids[0]);
    } catch {}
  }

  const posts =
    postIdsToFetch.length > 0
      ? await db.socialPost.findMany({
          where: { id: { in: postIdsToFetch } },
          select: { id: true, source: true, authorHandle: true, nlpMeta: true },
        })
      : [];

  const postMetaMap = new Map<string, { photo: string | null; mismatchReason: string | null; source: string | null; authorHandle: string | null }>();
  for (const p of posts) {
    let photo: string | null = null;
    let mismatchReason: string | null = null;
    if (p.nlpMeta) {
      try {
        const parsed = JSON.parse(p.nlpMeta) as { ai?: { photo?: string; mismatch?: { detected?: boolean; reason?: string } } };
        photo = parsed?.ai?.photo ?? null;
        mismatchReason = parsed?.ai?.mismatch?.detected ? (parsed?.ai?.mismatch?.reason ?? null) : null;
      } catch {}
    }
    postMetaMap.set(p.id, {
      photo,
      mismatchReason,
      source: p.source,
      authorHandle: p.authorHandle,
    });
  }

  const reports = rows.map((r) => {
    let firstPostId: string | undefined;
    try {
      const ids = JSON.parse(r.postIds || "[]") as string[];
      firstPostId = ids[0];
    } catch {}
    const meta = firstPostId ? postMetaMap.get(firstPostId) : null;

    return {
      id: r.id,
      code: r.code,
      eventType: r.eventType,
      severity: r.severity,
      placeLabel: r.placeLabel,
      lat: r.lat,
      lon: r.lon,
      title: r.title,
      summary: r.summary,
      advisory: r.advisory ? JSON.parse(r.advisory) : null,
      status: r.status,
      openedAt: r.openedAt.toISOString(),
      lastScenarioAt: r.lastScenarioAt.toISOString(),
      lastActivityAt: r.lastActivityAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      resolvedBy: r.resolvedBy,
      resolutionNote: r.resolutionNote,
      postCount: r.postCount,
      maxTrust: r.maxTrust,
      verification: r.verification,
      scenario: r.scenario,
      notificationsSent: r.notificationsSent,
      photo: meta?.photo ?? null,
      mismatchReason: meta?.mismatchReason ?? null,
      source: meta?.source ?? null,
      authorHandle: meta?.authorHandle ?? null,
    };
  });

  return NextResponse.json({
    ok: true,
    reports,
    counts: { open: openCount, resolved: resolvedCount, total: openCount + resolvedCount, notifications: notifCount, flagged: flaggedCount },
    serverTime: new Date().toISOString(),
  });
}
