import { NextResponse } from "next/server";
import { ingestPosts, type RawSocialPost } from "@/lib/social/ingest";

export const dynamic = "force-dynamic";

// POST /api/social/ingest — feed raw social/public posts into the NLP →
// geocode → trust pipeline. Accepts {posts: [...]} (max 25) or a single post.
// `timeScale` mirrors replay speed so corroboration windows stay meaningful.
export async function POST(req: Request) {
  let body: { posts?: unknown; timeScale?: number } & Partial<RawSocialPost>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const raws: RawSocialPost[] = Array.isArray(body.posts)
    ? (body.posts as RawSocialPost[])
    : body.text
      ? [body as RawSocialPost]
      : [];

  if (raws.length === 0) return NextResponse.json({ ok: false, error: "no posts provided" }, { status: 400 });
  if (raws.length > 25) return NextResponse.json({ ok: false, error: "max 25 posts per request" }, { status: 400 });

  const { results, inserted, duplicates } = await ingestPosts(raws, { timeScale: body.timeScale });
  return NextResponse.json({ ok: true, inserted, duplicates, results }, { status: 201 });
}
