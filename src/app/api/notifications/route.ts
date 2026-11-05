import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { distanceKm } from "@/lib/social/gazetteer";
import type { CitizenAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";

// GET /api/notifications — citizen alerts for the user's area.
// ?lat=&lon=  → only notifications whose incident is within the alert radius
//               of the user (geo-targeted: users NEAR the incident get it).
// ?limit=     → default 20
//
// POST /api/notifications — mark read. Body: { ids: string[] } or { all: true }
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 20)));
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon);

  const rows = await db.userNotification.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  const alerts: CitizenAlert[] = rows
    .filter((n) => {
      if (!hasPos) return true;
      return distanceKm({ lat, lon }, { lat: n.lat, lon: n.lon }) <= (n.radiusKm || 5);
    })
    .slice(0, limit)
    .map((n) => ({
      id: n.id,
      reportId: n.reportId,
      kind: n.kind as CitizenAlert["kind"],
      areaLabel: n.areaLabel,
      lat: n.lat,
      lon: n.lon,
      radiusKm: n.radiusKm,
      headline: n.headline,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      read: n.readAt != null,
      meta: n.meta ? JSON.parse(n.meta) : null,
    }));

  const unread = alerts.filter((a) => !a.read).length;
  return NextResponse.json({ ok: true, alerts, unread, total: rows.length });
}

export async function POST(req: Request) {
  let body: { ids?: string[]; all?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const now = new Date();
  if (body.all) {
    await db.userNotification.updateMany({ where: { readAt: null }, data: { readAt: now } });
    return NextResponse.json({ ok: true, marked: "all" });
  }
  if (Array.isArray(body.ids) && body.ids.length > 0) {
    await db.userNotification.updateMany({ where: { id: { in: body.ids } }, data: { readAt: now } });
    return NextResponse.json({ ok: true, marked: body.ids.length });
  }
  return NextResponse.json({ ok: false, error: "nothing to mark" }, { status: 400 });
}
