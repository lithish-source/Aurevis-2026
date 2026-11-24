import { NextResponse } from "next/server";
import { dualWrite } from "@/lib/report-server";

export const dynamic = "force-dynamic";

// POST /api/report/test — creates a test diagnostics event to verify sync with local & Supabase stores.
export async function POST(req: Request) {
  let body: { deviceId?: string; userId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body allowed
  }

  const result = await dualWrite("analyticsEvent", "analytics_events", {
    name: "sync_test_ping",
    payload: JSON.stringify({ pingAt: new Date().toISOString(), client: "diagnostics" }),
    userId: body.userId || null,
    deviceId: body.deviceId || null,
  });

  return NextResponse.json(
    {
      ok: true,
      message: result.supabase.ok
        ? "Mirrored to Supabase successfully"
        : result.supabase.skipped
        ? "Logged locally (Supabase not configured)"
        : `Logged locally (Supabase sync: ${result.supabase.error || "error"})`,
      event: result.local.row,
      supabase: result.supabase,
    },
    { status: 201 },
  );
}
