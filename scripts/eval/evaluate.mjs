#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// evaluate.mjs — offline evaluation of the social NLP + verification pipeline.
//
//   bun scripts/eval/evaluate.mjs [--target http://localhost:3000]
//                                  [--mode classification|verification|all]
//
// Phase 1 (classification): every labeled corpus post → POST /api/social/eval
//   → compare predictions with ground truth → accuracy / precision / recall /
//   F1 for isMobility, eventType, severity, sentiment + confusion matrix.
// Phase 2 (verification): replays every scenario at high speed into the DB,
//   then checks how corpus rumors ended up (should NOT be "verified") and how
//   corroborated true events ended up (should reach "verified").
//
// Writes download/evaluation-report.md.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};

const TARGET = flag("target", process.env.REPLAY_TARGET ?? "http://localhost:3000").replace(/\/+$/, "");
const MODE = flag("mode", "all");

const TYPES = ["congestion", "accident", "flood", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard", "other"];
const SEVS = ["low", "medium", "high", "critical"];
const SENTS = ["negative", "neutral", "positive"];

const corpusPath = path.join(process.cwd(), "data", "social", "corpus.jsonl");
const corpus = (await readFile(corpusPath, "utf-8"))
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const pct = (x) => `${(x * 100).toFixed(1)}%`;

// ── phase 1: classification metrics ─────────────────────────────────────────
async function classificationEval() {
  const predictions = new Map();
  const batches = [];
  for (let i = 0; i < corpus.length; i += 12) batches.push(corpus.slice(i, i + 12));

  for (const [bi, batch] of batches.entries()) {
    let predictionsBatch = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(`${TARGET}/api/social/eval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: batch.map((p) => ({ id: p.id, text: p.text, source: p.source })) }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(`eval endpoint failed: ${j.error}`);
      const allHeuristic = j.predictions.every((p) => p.engine === "heuristic");
      if (!allHeuristic || attempt === 3) {
        predictionsBatch = j;
        process.stdout.write(`  classify batch ${bi + 1}/${batches.length} (${j.elapsedMs} ms${allHeuristic ? ", heuristic fallback" : ""})\r`);
        break;
      }
      // LLM rate-limited — cool down and retry this batch
      process.stdout.write(`  batch ${bi + 1} hit rate limit, waiting 25s (attempt ${attempt}/3)…\n`);
      await new Promise((r) => setTimeout(r, 25_000));
    }
    for (const pred of predictionsBatch.predictions) predictions.set(pred.id, pred);
    await new Promise((r) => setTimeout(r, 3000)); // pace between batches
  }
  console.log("");

  const lines = [];
  const engines = {};
  for (const p of corpus) engines[predictions.get(p.id)?.engine ?? "heuristic"] = (engines[predictions.get(p.id)?.engine ?? "heuristic"] ?? 0) + 1;
  // isMobility accuracy
  let mobCorrect = 0;
  const mobConf = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const p of corpus) {
    const pred = predictions.get(p.id);
    const t = p.labels.isMobility;
    const y = pred?.isMobility ?? false;
    if (t === y) mobCorrect++;
    if (t && y) mobConf.tp++;
    else if (!t && y) mobConf.fp++;
    else if (t && !y) mobConf.fn++;
    else mobConf.tn++;
  }
  const mobAcc = mobCorrect / corpus.length;
  const mobPrec = mobConf.tp / (mobConf.tp + mobConf.fp || 1);
  const mobRec = mobConf.tp / (mobConf.tp + mobConf.fn || 1);
  const mobF1 = (2 * mobPrec * mobRec) / (mobPrec + mobRec || 1);

  // event-type metrics (only over mobility-labelled posts)
  const mobPosts = corpus.filter((p) => p.labels.isMobility);
  const confusion = {};
  for (const t of TYPES) confusion[t] = Object.fromEntries(TYPES.map((y) => [y, 0]));
  let typeCorrect = 0;
  for (const p of mobPosts) {
    const pred = predictions.get(p.id);
    const t = p.labels.eventType;
    const y = pred?.eventType ?? "other";
    confusion[t][y]++;
    if (t === y) typeCorrect++;
  }
  const perType = TYPES.map((t) => {
    const tp = confusion[t][t];
    const fn = TYPES.reduce((s, o) => s + (o === t ? 0 : confusion[t][o]), 0);
    const fp = TYPES.reduce((s, o) => s + (o === t ? 0 : confusion[o][t]), 0);
    const prec = tp / (tp + fp || 1);
    const rec = tp / (tp + fn || 1);
    return { type: t, tp, fp, fn, prec, rec, f1: (2 * prec * rec) / (prec + rec || 1), support: tp + fn };
  });
  // macro F1 over classes that actually occur in the corpus
  const supported = perType.filter((c) => c.support > 0);
  const macroF1 = supported.reduce((s, c) => s + c.f1, 0) / (supported.length || 1);

  // severity & sentiment accuracy
  let sevCorrect = 0, sevAdj = 0, sentCorrect = 0;
  for (const p of mobPosts) {
    const pred = predictions.get(p.id);
    if ((pred?.severity ?? "medium") === p.labels.severity) sevCorrect++;
    sevAdj += Math.abs(SEVS.indexOf(pred?.severity ?? "medium") - SEVS.indexOf(p.labels.severity)) <= 1 ? 1 : 0;
    if ((pred?.sentiment ?? "neutral") === p.labels.sentiment) sentCorrect++;
  }

  lines.push("## Phase 1 — NLP classification (LLM engine)");
  lines.push("");
  lines.push(`Corpus: **${corpus.length} posts** (${mobPosts.length} mobility events, ${corpus.length - mobPosts.length} noise) · engine mix: ${Object.entries(engines).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  lines.push("");
  lines.push("### Mobility-event detection (isMobility)");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---|");
  lines.push(`| Accuracy | ${pct(mobAcc)} (${mobCorrect}/${corpus.length}) |`);
  lines.push(`| Precision | ${pct(mobPrec)} |`);
  lines.push(`| Recall | ${pct(mobRec)} |`);
  lines.push(`| F1 | ${pct(mobF1)} |`);
  lines.push("");
  lines.push("### Event-type classification (mobility posts only)");
  lines.push("");
  lines.push("| Event type | Support | Precision | Recall | F1 |");
  lines.push("|---|---|---|---|---|");
  for (const c of perType) {
    const support = c.tp + c.fn;
    if (!support) continue;
    lines.push(`| ${c.type} | ${support} | ${pct(c.prec)} | ${pct(c.rec)} | ${pct(c.f1)} |`);
  }
  lines.push(`| **macro F1** | ${mobPosts.length} | | | **${pct(macroF1)}** |`);
  lines.push(`| exact-match accuracy | ${mobPosts.length} | | | ${pct(typeCorrect / (mobPosts.length || 1))} |`);
  lines.push("");
  lines.push("### Severity & sentiment");
  lines.push("");
  lines.push("| Task | Exact | Within ±1 level |");
  lines.push("|---|---|---|");
  lines.push(`| Severity | ${pct(sevCorrect / (mobPosts.length || 1))} | ${pct(sevAdj / (mobPosts.length || 1))} |`);
  lines.push(`| Sentiment | ${pct(sentCorrect / (mobPosts.length || 1))} | — |`);
  lines.push("");
  lines.push("### Event-type confusion matrix (rows = truth, cols = predicted)");
  lines.push("");
  const usedTypes = TYPES.filter((t) => mobPosts.some((p) => p.labels.eventType === t));
  lines.push(`| | ${usedTypes.join(" | ")} |`);
  lines.push(`|---|${usedTypes.map(() => "---").join("|")}|`);
  for (const t of usedTypes) {
    lines.push(`| **${t}** | ${usedTypes.map((y) => confusion[t][y]).join(" | ")} |`);
  }
  lines.push("");
  return lines.join("\n");
}

// ── phase 2: verification effectiveness ─────────────────────────────────────
async function verificationEval() {
  const scenarios = [...new Set(corpus.map((p) => p.scenario))];
  const lines = [];

  for (const scenario of scenarios) {
    await fetch(`${TARGET}/api/social/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    }).catch(() => null);
    const started = await (await fetch(`${TARGET}/api/social/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, speed: 600, reset: false }),
    }).catch(() => null))?.json();
    if (started?.ok === false) {
      console.log(`  ⚠ replay start failed for ${scenario}: ${started.error}`);
      continue;
    }
    // wait for THIS scenario's replay to finish before starting the next
    // (the controller only allows one replay at a time)
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const s = await (await fetch(`${TARGET}/api/social/replay`)).json();
      if (!s.running) break;
    }
    console.log(`  replayed ${scenario}`);
  }

  const feedByScenario = new Map();
  for (const scenario of scenarios) {
    const f = await (await fetch(`${TARGET}/api/social/feed?limit=200&scenario=${scenario}&includeAll=1`)).json();
    feedByScenario.set(scenario, f.posts);
  }

  let rumorTotal = 0, rumorVerified = 0, rumorFlagged = 0, rumorUnverified = 0;
  let trueTotal = 0, trueVerified = 0, trueUnverified = 0, trueFlagged = 0;
  const rumorRows = [];

  for (const scenario of scenarios) {
    const stored = feedByScenario.get(scenario) ?? [];
    for (const p of corpus.filter((x) => x.scenario === scenario && x.labels.isMobility)) {
      const row = stored.find((s) => s.text === p.text);
      if (!row) continue;
      if (p.labels.isRumor) {
        rumorTotal++;
        if (row.verification === "verified") rumorVerified++;
        else if (row.verification === "flagged") rumorFlagged++;
        else rumorUnverified++;
        rumorRows.push({ id: p.id, scenario, text: p.text.slice(0, 70), verification: row.verification, trust: row.trustScore });
      } else {
        trueTotal++;
        if (row.verification === "verified") trueVerified++;
        else if (row.verification === "flagged") trueFlagged++;
        else trueUnverified++;
      }
    }
  }

  const suppression = rumorTotal ? 1 - rumorVerified / rumorTotal : 0;
  const confirmation = trueTotal ? trueVerified / trueTotal : 0;

  lines.push("## Phase 2 — Verification effectiveness (full-pipeline replay)");
  lines.push("");
  lines.push(`All scenarios replayed end-to-end (classify → geocode → cluster → trust).`);
  lines.push("");
  lines.push("| Group | n | verified | unverified | flagged |");
  lines.push("|---|---|---|---|---|");
  lines.push(`| Rumor / exaggerated posts | ${rumorTotal} | ${rumorVerified} | ${rumorUnverified} | ${rumorFlagged} |`);
  lines.push(`| True event posts | ${trueTotal} | ${trueVerified} | ${trueUnverified} | ${trueFlagged} |`);
  lines.push("");
  lines.push(`- **Misinformation suppression rate** (rumors NOT shown as verified): **${pct(suppression)}**`);
  lines.push(`- **True-event confirmation rate** (true posts reaching verified): **${pct(confirmation)}**`);
  lines.push("");
  lines.push("### Rumor posts — final pipeline verdict");
  lines.push("");
  lines.push("| id | scenario | verdict | trust | post |");
  lines.push("|---|---|---|---|---|");
  for (const r of rumorRows) {
    lines.push(`| ${r.id} | ${r.scenario} | ${r.verification} | ${(r.trust * 100).toFixed(0)}% | ${r.text.replace(/\|/g, "/")}… |`);
  }
  lines.push("");
  return lines.join("\n");
}

// ── run ──────────────────────────────────────────────────────────────────────
console.log(`Evaluating pipeline at ${TARGET} (mode: ${MODE})\n`);
const sections = ["# Social Mobility-Pulse Pipeline — Evaluation Report", "",
  `Generated ${new Date().toISOString()} · corpus: data/social/corpus.jsonl (${corpus.length} posts)`, ""];

if (MODE === "classification" || MODE === "all") {
  console.log("Phase 1: classification…");
  sections.push(await classificationEval());
}
if (MODE === "verification" || MODE === "all") {
  console.log("Phase 2: verification (replaying scenarios)…");
  sections.push(await verificationEval());
}

const report = sections.join("\n");
const outDir = path.join(process.cwd(), "download");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "evaluation-report.md"), report, "utf-8");
console.log(`\n✅ report → download/evaluation-report.md`);
