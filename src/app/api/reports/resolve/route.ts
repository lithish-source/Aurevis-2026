import { NextResponse } from "next/server";
import { resolveReport } from "@/lib/social/reports";

export const dynamic = "force-dynamic";

// POST /api/reports/resolve — admin marks a report solved.
// Body: { id: string, note?: string, admin?: string }
// Side effect: pushes an "all clear" notification to users near the incident.
export async function POST(req: Request) {
  let body: { id?: string; note?: string; admin?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "missing report id" }, { status: 400 });

  const result = await resolveReport({ reportId: body.id, note: body.note, admin: body.admin });
  if (!result.ok) return NextResponse.json(result, { status: result.error === "already resolved" ? 409 : 404 });
  return NextResponse.json(result);
}
