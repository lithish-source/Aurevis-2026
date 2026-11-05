import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/social/feed — verified/unverified mobility events for the City
// Pulse map + feed. Supports ?limit= &scenario= &verification= &includeAll=1
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 60)));
  const scenario = url.searchParams.get("scenario");
  const verification = url.searchParams.get("verification");
  const includeAll = url.searchParams.get("includeAll") === "1";

  const where: Record<string, unknown> = {};
  if (!includeAll) where.isMobility = true;
  if (scenario) where.scenario = scenario;
  if (verification === "verified" || verification === "unverified" || verification === "flagged") {
    where.verification = verification;
  }

  const [rows, totalCount, filteredOut, status] = await Promise.all([
    db.socialPost.findMany({ where, orderBy: { postedAt: "desc" }, take: limit }),
    db.socialPost.count({ where: { isMobility: true, ...(scenario ? { scenario } : {}) } }),
    db.socialPost.count({ where: { isMobility: false, ...(scenario ? { scenario } : {}) } }),
    db.socialPost.findMany({
      where: { isMobility: true, ...(scenario ? { scenario } : {}) },
      select: { verification: true },
    }),
  ]);

  const counts = { verified: 0, unverified: 0, flagged: 0 };
  for (const s of status) {
    if (s.verification === "verified") counts.verified++;
    else if (s.verification === "unverified") counts.unverified++;
    else if (s.verification === "flagged") counts.flagged++;
  }

  const posts = rows.map((r) => ({
    id: r.id,
    source: r.source,
    handle: r.authorHandle,
    text: r.text,
    postedAt: r.postedAt.toISOString(),
    isMobility: r.isMobility,
    eventType: r.eventType,
    severity: r.severity,
    sentiment: r.sentiment,
    summary: r.summary,
    placeLabel: r.placeLabel,
    lat: r.lat,
    lon: r.lon,
    trustScore: r.trustScore,
    verification: r.verification,
    corroborates: r.corroborates,
    scenario: r.scenario,
  }));

  return NextResponse.json({
    ok: true,
    posts,
    counts: { ...counts, total: totalCount, filteredOut },
    generatedAt: new Date().toISOString(),
  });
}
