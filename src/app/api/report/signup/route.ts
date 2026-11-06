import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dualWrite } from "@/lib/report-server";

export const dynamic = "force-dynamic";

// POST /api/report/signup — create (or refresh) the app account.
export async function POST(req: Request) {
  let body: { name?: string; phone?: string; email?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const deviceId = (body.deviceId || "").trim();
  if (!name || !deviceId) {
    return NextResponse.json({ ok: false, error: "name and deviceId are required" }, { status: 400 });
  }

  const existing = await db.appUser.findUnique({ where: { deviceId } });

  const result = await dualWrite(
    "appUser",
    "app_users",
    {
      deviceId,
      name,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      city: "Chennai",
    },
    { upsertOn: "device_id" },
  );

  // For an existing device we upserted — return the merged row.
  const user = existing
    ? await db.appUser.findUnique({ where: { deviceId } })
    : result.local.row;

  return NextResponse.json({ ok: true, user, supabase: result.supabase }, { status: 201 });
}
