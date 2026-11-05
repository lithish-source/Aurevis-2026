import { NextResponse } from "next/server";
import { classifyPosts, type ClassifyInput } from "@/lib/social/classify";

export const dynamic = "force-dynamic";

// POST /api/social/eval — classification-only endpoint for the offline
// evaluation script. No database writes, no trust scoring.
export async function POST(req: Request) {
  let body: { posts?: ClassifyInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const posts = (body.posts ?? []).filter((p) => p && typeof p.text === "string" && p.text.trim());
  if (posts.length === 0) return NextResponse.json({ ok: false, error: "no posts provided" }, { status: 400 });
  if (posts.length > 25) return NextResponse.json({ ok: false, error: "max 25 posts per request" }, { status: 400 });

  const t0 = Date.now();
  const results = await classifyPosts(posts, { timeoutMs: 60_000, batchSize: 8 });
  const predictions = posts.map((p) => {
    const r = results.get(p.id);
    return {
      id: p.id,
      isMobility: r?.isMobility ?? false,
      eventType: r?.eventType ?? "other",
      severity: r?.severity ?? "medium",
      sentiment: r?.sentiment ?? "neutral",
      locations: r?.locations ?? [],
      engine: r?.engine ?? "heuristic",
    };
  });

  return NextResponse.json({ ok: true, predictions, elapsedMs: Date.now() - t0 });
}
