import { NextResponse } from "next/server";
import { dualWrite } from "@/lib/report-server";

export const dynamic = "force-dynamic";

// POST /api/report/sos — record an SOS press/cancel with location.
export async function POST(req: Request) {
  let body: { kind?: string; lat?: number; lon?: number; userId?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const result = await dualWrite("sosEvent", "sos_events", {
    kind: body.kind === "sos_cancelled" ? "sos_cancelled" : "sos_pressed",
    lat: Number.isFinite(body.lat) ? Number(body.lat) : null,
    lon: Number.isFinite(body.lon) ? Number(body.lon) : null,
    userId: body.userId || null,
    deviceId: body.deviceId || null,
  });

  return NextResponse.json({ ok: true, sos: result.local.row, supabase: result.supabase }, { status: 201 });
}
