#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// build-corpus.mjs — build data/social/corpus.jsonl
//
//   bun scripts/corpus/build-corpus.mjs
//
// Merges:
//   1. Built-in synthetic Chennai scenarios (scripts/corpus/scenarios.mjs)
//   2. Any real datasets placed under data/social/raw/:
//        • *.jsonl  — one post per line:
//            { text, source?, author?, postedAt?, tOffsetMin?, scenario?,
//              labels: { isMobility, eventType, severity, sentiment, isRumor } }
//        • CrisisLex CSVs (crisislex_*.csv) — tweet text + informativeness
//          labels; event type is taken from the filename.
// See data/social/raw/README.md for where to download real datasets.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { POSTS, SCENARIOS } from "./scenarios.mjs";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data", "social", "raw");
const OUT_FILE = path.join(ROOT, "data", "social", "corpus.jsonl");

const SOURCE_MAP = { twitter: "twitter", x: "twitter", reddit: "reddit", instagram: "instagram", facebook: "facebook", telegram: "telegram", news: "news", official: "official" };
const TYPES = ["congestion", "accident", "flood", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard", "other"];

function sha(s) {
  return createHash("sha1").update(s).digest("hex").slice(0, 12);
}

// ── CrisisLex CSV loader ─────────────────────────────────────────────────────
// CrisisLexT26 files look like: Tweet ID, Tweet Text, " Information Type",
// " Information Source", " Account Type", plus per-event columns. We keep
// tweets whose informativeness is "Related and informative".
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function eventTypeFromCrisisLexName(file) {
  const f = file.toLowerCase();
  if (/flood|storm|typhoon|hurricane|cyclone|monsoon/.test(f)) return "flood";
  if (/crash|collapse|quake|earthquake|derail/.test(f)) return "infrastructure";
  if (/shoot|bomb|attack|blast/.test(f)) return "hazard";
  if (/fire|wildfire|blaze/.test(f)) return "hazard";
  if (/protest|riot/.test(f)) return "protest";
  return "other";
}

async function loadRawDatasets() {
  const posts = [];
  let files = [];
  try {
    files = await readdir(RAW_DIR);
  } catch {
    return posts; // no raw dir → built-in corpus only
  }

  for (const file of files) {
    const full = path.join(RAW_DIR, file);
    const ext = path.extname(file).toLowerCase();
    const scenario = `raw-${path.basename(file, ext).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;

    if (ext === ".jsonl" || ext === ".json") {
      const raw = await readFile(full, "utf-8");
      const lines = ext === ".json" ? [raw] : raw.split("\n").filter((l) => l.trim());
      let i = 0;
      for (const line of lines) {
        try {
          const o = JSON.parse(line);
          const text = String(o.text ?? o.tweet ?? "").trim();
          if (!text) continue;
          const labels = o.labels ?? {};
          posts.push({
            id: `raw-${sha(`${file}:${i}`)}`,
            scenario,
            source: SOURCE_MAP[String(o.source ?? "twitter").toLowerCase()] ?? "twitter",
            author: {
              handle: o.author?.handle ?? o.handle ?? o.user ?? "unknown",
              accountAgeDays: o.author?.accountAgeDays ?? null,
              followers: o.author?.followers ?? null,
              verified: o.author?.verified ?? false,
            },
            text,
            tOffsetMin: Number(o.tOffsetMin ?? i * 3),
            labels: {
              isMobility: labels.isMobility ?? true,
              eventType: TYPES.includes(labels.eventType) ? labels.eventType : eventTypeFromCrisisLexName(file),
              severity: labels.severity ?? "medium",
              sentiment: labels.sentiment ?? "negative",
              isRumor: Boolean(labels.isRumor),
            },
          });
          i++;
        } catch { /* skip malformed line */ }
      }
      console.log(`  + ${file}: ${i} posts`);
    } else if (ext === ".csv" && /crisislex/i.test(file)) {
      const raw = await readFile(full, "utf-8");
      const lines = raw.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) continue;
      const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z ]/g, "").trim());
      const textCol = header.findIndex((h) => h.includes("tweet text") || h === "text");
      const infoCol = header.findIndex((h) => h.includes("information type"));
      let i = 0;
      for (let li = 1; li < lines.length; li++) {
        const cols = parseCsvLine(lines[li]);
        const text = textCol >= 0 ? (cols[textCol] ?? "") : "";
        const info = infoCol >= 0 ? (cols[infoCol] ?? "") : "";
        if (!text) continue;
        if (info && !/related and informative/i.test(info)) continue; // keep informative crisis tweets
        posts.push({
          id: `raw-${sha(`${file}:${li}`)}`,
          scenario,
          source: "twitter",
          author: { handle: `clx_${sha(text).slice(0, 6)}`, accountAgeDays: null, followers: null, verified: false },
          text,
          tOffsetMin: i * 3,
          labels: { isMobility: true, eventType: eventTypeFromCrisisLexName(file), severity: "medium", sentiment: "negative", isRumor: false },
        });
        i++;
      }
      console.log(`  + ${file}: ${i} informative posts`);
    }
  }
  return posts;
}

// ── main ─────────────────────────────────────────────────────────────────────
const builtIn = POSTS.map((p) => ({
  id: p.id,
  scenario: p.scenario,
  source: p.source,
  author: p.author,
  text: p.text,
  tOffsetMin: p.tOffsetMin,
  labels: p.labels,
}));

console.log("Building social replay corpus…");
console.log(`  + built-in scenarios: ${builtIn.length} posts`);
const rawPosts = await loadRawDatasets();

const all = [...builtIn, ...rawPosts].sort((a, b) => {
  const s = SCENARIOS.indexOf(a.scenario) - SCENARIOS.indexOf(b.scenario);
  return s !== 0 ? s : a.tOffsetMin - b.tOffsetMin;
});

await mkdir(path.dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, all.map((p) => JSON.stringify(p)).join("\n") + "\n", "utf-8");

// manifest for quick sanity checks
const manifest = {
  total: all.length,
  byScenario: {},
  byType: {},
  rumors: 0,
  noise: 0,
  generatedAt: new Date().toISOString(),
};
for (const p of all) {
  manifest.byScenario[p.scenario] = (manifest.byScenario[p.scenario] ?? 0) + 1;
  manifest.byType[p.labels.eventType] = (manifest.byType[p.labels.eventType] ?? 0) + 1;
  if (p.labels.isRumor) manifest.rumors++;
  if (!p.labels.isMobility) manifest.noise++;
}
await writeFile(path.join(ROOT, "data", "social", "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

console.log(`\n✅ wrote ${all.length} posts → data/social/corpus.jsonl`);
console.log(JSON.stringify(manifest, null, 2));
