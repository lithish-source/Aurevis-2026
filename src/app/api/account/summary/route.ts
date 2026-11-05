import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/account/summary?deviceId=… — everything the app knows about this
// device's account: user, tickets, passes and SOS history (local DB).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "deviceId is required" }, { status: 400 });
  }

  const user = await db.appUser.findUnique({ where: { deviceId } });

  const [tickets, passes, sos] = await Promise.all([
    db.ticketPurchase.findMany({ where: { deviceId }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.passPurchase.findMany({ where: { deviceId }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.sosEvent.findMany({ where: { deviceId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const spent =
    tickets.reduce((sum, t) => sum + t.fare, 0) + passes.reduce((sum, p) => sum + p.price, 0);

  return NextResponse.json({
    ok: true,
    user,
    tickets,
    passes,
    sos,
    stats: { trips: tickets.length + passes.length, spent, sosCount: sos.length },
  });
}
