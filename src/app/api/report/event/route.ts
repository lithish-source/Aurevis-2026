import { NextResponse } from "next/server";
import { dualWrite } from "@/lib/report-server";

export const dynamic = "force-dynamic";

// POST /api/report/event — generic analytics event (screen views, taps…).
export async function POST(req: Request) {
  let body: { name?: string; payload?: unknown; userId?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }

  const result = await dualWrite<"analyticsEvent">("analyticsEvent", "analytics_events", {
    name: body.name.trim().slice(0, 80),
    payload: JSON.stringify(body.payload ?? {}),
    userId: body.userId || null,
    deviceId: body.deviceId || null,
  });

  return NextResponse.json({ ok: true, event: result.local.row, supabase: result.supabase }, { status: 201 });
}
