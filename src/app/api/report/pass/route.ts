import { NextResponse } from "next/server";
import { dualWrite } from "@/lib/report-server";

export const dynamic = "force-dynamic";

// POST /api/report/pass — record a travel pass purchase.
export async function POST(req: Request) {
  let body: { passId?: string; name?: string; price?: number; validity?: string; userId?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  if (!body.passId || !body.name) {
    return NextResponse.json({ ok: false, error: "passId and name are required" }, { status: 400 });
  }

  const result = await dualWrite<"passPurchase">("passPurchase", "pass_purchases", {
    passId: body.passId,
    name: body.name,
    price: Number(body.price) || 0,
    validity: body.validity || "",
    userId: body.userId || null,
    deviceId: body.deviceId || null,
  });

  return NextResponse.json({ ok: true, pass: result.local.row, supabase: result.supabase }, { status: 201 });
}
