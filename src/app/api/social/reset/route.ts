import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/social/reset — clear the social pulse store (all posts, or one
// scenario) before a fresh replay run. Incident reports and citizen
// notifications linked to those posts are cleared too.
export async function POST(req: Request) {
  let scenario: string | undefined;
  try {
    const body = await req.json();
    scenario = typeof body?.scenario === "string" && body.scenario ? body.scenario : undefined;
  } catch {
    scenario = undefined;
  }
  const where = scenario ? { scenario } : {};
  const [posts, reports, notifs] = await Promise.all([
    db.socialPost.deleteMany({ where }),
    db.incidentReport.deleteMany({ where }),
    db.userNotification.deleteMany({}),
  ]);
  return NextResponse.json({
    ok: true,
    deleted: posts.count,
    reportsDeleted: reports.count,
    notificationsDeleted: notifs.count,
    scenario: scenario ?? "all",
  });
}
