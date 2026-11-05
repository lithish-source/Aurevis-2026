import { NextResponse } from "next/server";
import { MAP_BUS_STOPS, MAP_METRO_STATIONS, MAP_RAILWAY_STATIONS, USER_LOCATION } from "@/lib/transit-data";

export const dynamic = "force-dynamic";

// GET /api/transit/stops/nearby?lat=13.032&lon=80.1755&mode=all&radius=1500
// Returns nearby bus stops / metro stations / railway stations sorted by
// distance (haversine, metres).

type Stop = { name: string; lat: number; lon: number; active?: boolean };
type WithDistance = Stop & { distanceM: number; category: "bus" | "metro" | "railway" };

function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat") ?? USER_LOCATION.lat);
  const lon = Number(searchParams.get("lon") ?? USER_LOCATION.lon);
  const mode = (searchParams.get("mode") ?? "all").toLowerCase();
  const radius = Math.min(20000, Math.max(100, Number(searchParams.get("radius") ?? 3000) || 3000));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ ok: false, error: "lat and lon must be numbers" }, { status: 400 });
  }

  const pools: { category: WithDistance["category"]; stops: Stop[] }[] = [];
  if (mode === "all" || mode === "bus") pools.push({ category: "bus", stops: MAP_BUS_STOPS });
  if (mode === "all" || mode === "metro") pools.push({ category: "metro", stops: MAP_METRO_STATIONS });
  if (mode === "all" || mode === "rail" || mode === "railway" || mode === "train")
    pools.push({ category: "railway", stops: MAP_RAILWAY_STATIONS });

  const all: WithDistance[] = pools.flatMap(({ category, stops }) =>
    stops.map((s) => ({ ...s, category, distanceM: haversine(lat, lon, s.lat, s.lon) })),
  );

  const nearby = all.filter((s) => s.distanceM <= radius).sort((a, b) => a.distanceM - b.distanceM);

  return NextResponse.json({
    ok: true,
    origin: { lat, lon },
    radius,
    count: nearby.length,
    stops: nearby,
    counts: {
      bus: nearby.filter((s) => s.category === "bus").length,
      metro: nearby.filter((s) => s.category === "metro").length,
      railway: nearby.filter((s) => s.category === "railway").length,
    },
    nearest: nearby[0] ?? null,
    generatedAt: new Date().toISOString(),
  });
}
