import { NextResponse } from "next/server";
import { pollAndIngestReddit, getRedditStatus } from "@/lib/social/reddit";

export const dynamic = "force-dynamic";

// GET /api/social/reddit/poll — check current status and recent Reddit posts
export async function GET() {
  const status = await getRedditStatus();
  return NextResponse.json({
    ok: true,
    ...status,
    checkedAt: new Date().toISOString(),
  });
}

// POST /api/social/reddit/poll — trigger live Reddit fetch & ingest into NLP pipeline
export async function POST(req: Request) {
  try {
    let limit = 10;
    try {
      const body = await req.json();
      if (typeof body.limit === "number") {
        limit = Math.max(1, Math.min(25, body.limit));
      }
    } catch {
      // default limit
    }

    const result = await pollAndIngestReddit(limit);
    const status = await getRedditStatus();

    return NextResponse.json({
      ...result,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/social/reddit/poll] error:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

