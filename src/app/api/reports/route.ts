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
  if (since) {
    const d = new Date(since);
    if (!Number.isNaN(d.getTime())) where.lastActivityAt = { gt: d };
  }

  const [rows, openCount, resolvedCount, notifCount] = await Promise.all([
    db.incidentReport.findMany({ where, orderBy: { lastActivityAt: "desc" }, take: limit }),
    db.incidentReport.count({ where: { status: "open" } }),
    db.incidentReport.count({ where: { status: "resolved" } }),
    db.userNotification.count(),
  ]);

  const reports = rows.map((r) => ({
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
  }));

  return NextResponse.json({
    ok: true,
    reports,
    counts: { open: openCount, resolved: resolvedCount, total: openCount + resolvedCount, notifications: notifCount },
    serverTime: new Date().toISOString(),
  });
}
