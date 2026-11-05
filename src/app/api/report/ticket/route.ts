import { NextResponse } from "next/server";
import { dualWrite } from "@/lib/report-server";

export const dynamic = "force-dynamic";

// POST /api/report/ticket — record a bus/metro QR ticket purchase.
export async function POST(req: Request) {
  let body: {
    ref?: string;
    mode?: string;
    routeNo?: string;
    from?: string;
    to?: string;
    passengers?: number;
    fare?: number;
    userId?: string;
    deviceId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const mode = body.mode === "metro" ? "metro" : "bus";
  const ref =
    body.ref?.trim() ||
    `${mode === "metro" ? "MTX" : "MTB"}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const fare = Number.isFinite(body.fare) ? Number(body.fare) : 0;

  const result = await dualWrite<"ticketPurchase">("ticketPurchase", "ticket_purchases", {
    ref,
    mode,
    routeNo: body.routeNo?.trim() || null,
    fromStop: body.from?.trim() || "Unknown",
    toStop: body.to?.trim() || "Unknown",
    passengers: Math.max(1, Number(body.passengers) || 1),
    fare,
    userId: body.userId || null,
    deviceId: body.deviceId || null,
  });

  return NextResponse.json({ ok: true, ticket: result.local.row, supabase: result.supabase }, { status: 201 });
}
