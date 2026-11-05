import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { ingestPosts, type RawSocialPost } from "@/lib/social/ingest";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Replay controller — streams the labeled corpus through the live pipeline on
// the scenario's own clock ("simulated real-time"). The same /api/social/ingest
// endpoint a live connector (Reddit / Telegram / GDELT poller) would call.
//
// POST /api/social/replay { scenario?, speed?, reset? }  → start
// GET  /api/social/replay                                 → status
// DELETE /api/social/replay                               → cancel

type ReplayState = {
  running: boolean;
  scenario: string;
  speed: number;
  total: number;
  sent: number;
  startedAt: number;
  finishedAt?: number;
  lastError?: string;
  timers: ReturnType<typeof setTimeout>[];
  cancelled: boolean;
};

const g = globalThis as unknown as { __chennaiOneReplay?: ReplayState };

const CORPUS_FILE = path.join(process.cwd(), "data", "social", "corpus.jsonl");

async function loadCorpus(scenario: string): Promise<Array<RawSocialPost & { tOffsetMin: number }>> {
  const raw = await readFile(CORPUS_FILE, "utf-8");
  const rows = raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Record<string, unknown>);
  const filtered = scenario === "all" ? rows : rows.filter((r) => r.scenario === scenario);
  return filtered.sort((a, b) => Number(a.tOffsetMin ?? 0) - Number(b.tOffsetMin ?? 0)) as Array<RawSocialPost & { tOffsetMin: number }>;
}

export async function POST(req: Request) {
  if (g.__chennaiOneReplay?.running) {
    return NextResponse.json({ ok: false, error: "a replay is already running" }, { status: 409 });
  }

  let body: { scenario?: string; speed?: number; reset?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* defaults */
  }
  const scenario = body.scenario || "monsoon-flood";
  const speed = Math.max(1, Math.min(600, body.speed ?? 24));

  let posts: Array<RawSocialPost & { tOffsetMin: number }>;
  try {
    posts = await loadCorpus(scenario);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `corpus not found — run \`bun scripts/corpus/build-corpus.mjs\` first (${e instanceof Error ? e.message : "read error"})` },
      { status: 500 },
    );
  }
  if (posts.length === 0) {
    return NextResponse.json({ ok: false, error: `no posts for scenario "${scenario}"` }, { status: 400 });
  }

  if (body.reset) {
    await db.socialPost.deleteMany({ where: scenario === "all" ? {} : { scenario } }).catch(() => undefined);
  }

  const state: ReplayState = {
    running: true,
    scenario,
    speed,
    total: posts.length,
    sent: 0,
    startedAt: Date.now(),
    timers: [],
    cancelled: false,
  };
  g.__chennaiOneReplay = state;

  const scenarioStart = Date.now() + 1_500; // small lead-in
  posts.forEach((p, i) => {
    // wall-clock delay = scenario offset / speed, plus a small stagger so
    // same-minute posts still arrive one after the other.
    const delay = Math.round((p.tOffsetMin * 60_000) / speed) + i * 250;
    const t = setTimeout(async () => {
      if (state.cancelled) return;
      try {
        const mapped: RawSocialPost = {
          ...p,
          postedAt: new Date(scenarioStart + Math.round((p.tOffsetMin * 60_000) / speed)).toISOString(),
        };
        await ingestPosts([mapped], { timeScale: speed });
        state.sent++;
      } catch (e) {
        state.lastError = e instanceof Error ? e.message : String(e);
        state.sent++;
      }
      if (state.sent >= state.total) {
        state.running = false;
        state.finishedAt = Date.now();
      }
    }, delay);
    state.timers.push(t);
  });

  const approxSec = Math.round((posts[posts.length - 1].tOffsetMin * 60) / speed);
  return NextResponse.json({
    ok: true,
    scenario,
    speed,
    total: posts.length,
    approxDurationSec: approxSec,
    message: `Replaying ${posts.length} posts (~${Math.ceil(approxSec / 60)} min wall-clock). Feed updates live.`,
  });
}

export async function GET() {
  const s = g.__chennaiOneReplay;
  if (!s) return NextResponse.json({ ok: true, running: false });
  return NextResponse.json({
    ok: true,
    running: s.running,
    scenario: s.scenario,
    speed: s.speed,
    sent: s.sent,
    total: s.total,
    elapsedSec: Math.round((Date.now() - s.startedAt) / 1000),
    lastError: s.lastError ?? null,
  });
}

export async function DELETE() {
  const s = g.__chennaiOneReplay;
  if (s) {
    s.cancelled = true;
    s.timers.forEach(clearTimeout);
    s.running = false;
    s.timers = [];
  }
  return NextResponse.json({ ok: true, cancelled: true });
}
