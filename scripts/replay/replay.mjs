#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// replay.mjs — paced corpus replayer (simulated real-time source).
//
//   bun scripts/replay/replay.mjs [--scenario monsoon-flood] [--speed 24]
//                                 [--target http://localhost:3000] [--reset]
//                                 [--quiet]
//
// Emits corpus posts in timestamp order to POST /api/social/ingest — the same
// endpoint a live connector (Reddit poller, Telegram watcher…) would call.
// `speed` compresses the scenario clock (24 → a 95-min scenario plays in ~4 min)
// and is passed as timeScale so corroboration windows keep their meaning.

import { readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const has = (name) => args.includes(`--${name}`);

const TARGET = flag("target", process.env.REPLAY_TARGET ?? "http://localhost:3000").replace(/\/+$/, "");
const SCENARIO = flag("scenario", "monsoon-flood");
const SPEED = Number(flag("speed", "24"));
const QUIET = has("quiet");
const RESET = has("reset");

const corpusPath = path.join(process.cwd(), "data", "social", "corpus.jsonl");
const raw = await readFile(corpusPath, "utf-8");
const all = raw
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));
const posts = (SCENARIO === "all" ? all : all.filter((p) => p.scenario === SCENARIO)).sort(
  (a, b) => a.tOffsetMin - b.tOffsetMin,
);

if (posts.length === 0) {
  console.error(`No posts for scenario "${SCENARIO}". Run bun scripts/corpus/build-corpus.mjs first.`);
  process.exit(1);
}

if (RESET) {
  const r = await fetch(`${TARGET}/api/social/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario: SCENARIO }),
  }).catch(() => null);
  const j = await r?.json().catch(() => null);
  console.log(`♻️  reset: deleted ${j?.deleted ?? "?"} stored posts (${SCENARIO})`);
}

const totalWallSec = Math.round((posts[posts.length - 1].tOffsetMin * 60) / SPEED);
console.log(`▶ replaying ${posts.length} posts of "${SCENARIO}" at ${SPEED}× (≈${Math.ceil(totalWallSec / 60)} min wall-clock) → ${TARGET}`);
console.log("");

const start = Date.now();
let n = 0;
for (const p of posts) {
  const delay = (p.tOffsetMin * 60_000) / SPEED - (Date.now() - start);
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  const postedAt = new Date(start + (p.tOffsetMin * 60_000) / SPEED).toISOString();
  const res = await fetch(`${TARGET}/api/social/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ posts: [{ ...p, postedAt }], timeScale: SPEED }),
  }).catch((e) => ({ ok: false, json: async () => ({ error: String(e) }) }));

  const j = await res.json().catch(() => ({}));
  const r = j.results?.[0];
  n++;
  if (!QUIET) {
    const info = r
      ? `${r.isMobility ? `${r.eventType}/${r.severity}` : "filtered"} · ${r.verification ?? "-"} ${(r.trustScore * 100).toFixed(0)}%` +
        (r.corroborates ? ` · +${r.corroborates} corrobor` : "")
      : `error: ${j.error ?? "unknown"}`;
    const clock = `+${String(Math.floor(p.tOffsetMin)).padStart(3)}m`;
    console.log(`${String(n).padStart(3)}/${posts.length} ${clock} [${p.source.padEnd(9)}] ${info}`);
    console.log(`            "${p.text.slice(0, 84)}${p.text.length > 84 ? "…" : ""}"`);
  } else if (!res.ok) {
    console.error(`post ${p.id} failed: ${j.error}`);
  }
}

console.log(`\n✅ replay finished: ${n} posts in ${((Date.now() - start) / 1000).toFixed(0)}s`);
console.log(`   view the feed:  ${TARGET}/  → Live → City Pulse`);
