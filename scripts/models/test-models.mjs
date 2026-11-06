// Standalone verification: BERT (zero-shot DistilBERT-MNLI) + YOLO (YOLOs-tiny)
// under the same Node runtime the Next.js server uses.
import { pipeline, env, RawImage } from "@huggingface/transformers";

env.cacheDir = "/home/z/my-project/.models";
env.allowLocalModels = false; // force remote fetch on first run

async function withRetry(fn, label, tries = 4, backoffMs = 30_000) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.message ?? e);
      console.log(`  [${label}] attempt ${i} failed: ${msg.slice(0, 100)}`);
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

const t0 = Date.now();
console.log("loading BERT zero-shot (distilbert-base-uncased-mnli, q8)…");
const zero = await withRetry(
  () => pipeline("zero-shot-classification", "Xenova/distilbert-base-uncased-mnli", { dtype: "q8" }),
  "bert",
);
console.log(`BERT loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const TYPE_LABELS = [
  "a road accident where vehicles crashed",
  "a flooded or waterlogged road",
  "a slow-moving traffic jam",
  "a public transport service breakdown",
  "a closed or barricaded road",
  "broken road infrastructure",
  "a street protest blocking traffic",
  "a dangerous street hazard like fire or fallen wires",
];
const SEV_LABELS = [
  "a minor inconvenience",
  "a moderate disruption",
  "a serious disruption",
  "a life-threatening emergency",
];
const TYPE_KEYS = ["accident", "flood", "congestion", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard"];
const SEV_KEYS = ["low", "medium", "high", "critical"];

const GOLD = [
  ["Knee-deep waterlogging under the bridge, autos refusing to ply, buses stuck", "flood", "high"],
  ["Bumper to bumper traffic near the signal, barely moving for the last 20 minutes", "congestion", "medium"],
  ["Two-wheeler skid near the signal, rider injured and bleeding, one lane blocked", "accident", "high"],
  ["Metro trains held at the station, announcement says a signal fault", "transit_disruption", "medium"],
  ["Road barricaded by police, traffic being diverted to the service lane", "road_closure", "medium"],
  ["Huge pothole in the middle of the road, two-wheelers skidding and falling", "infrastructure", "medium"],
  ["Protest march on the carriageway, road completely blocked", "protest", "high"],
  ["Transformer bursting with thick black smoke near the bus stop", "hazard", "critical"],
  ["Lorry collided with an auto near the toll gate, people trapped inside", "accident", "critical"],
  ["Slight water pooling on the road side after the rain, traffic moving fine", "flood", "low"],
];

let typeHits = 0;
let sevHits = 0;
for (const [text, expType, expSev] of GOLD) {
  const type = await zero(text, TYPE_LABELS, { multi_label: false });
  const sev = await zero(text, SEV_LABELS, { multi_label: false });
  const gotType = TYPE_KEYS[type.labels.indexOf(type.labels[0])];
  const gotSev = SEV_KEYS[sev.labels.indexOf(sev.labels[0])];
  const tOk = gotType === expType;
  const sOk = gotSev === expSev;
  typeHits += tOk;
  sevHits += sOk;
  const sevScores = sev.labels.map((l, i) => ({ k: SEV_KEYS[i], s: sev.scores[i] }));
  console.log(
    `${tOk ? "✓" : "✗"}${sOk ? "✓" : "✗"} "${text.slice(0, 48)}" → ${gotType}(${(type.scores[0] * 100).toFixed(0)}%) / ${gotSev} | ` +
      sevScores.map((x) => `${x.k}:${(x.s * 100).toFixed(0)}`).join(" "),
  );
}
console.log(`\nTYPE ${typeHits}/${GOLD.length}  SEV ${sevHits}/${GOLD.length}`);

const t1 = Date.now();
console.log("\nloading YOLO (yolos-tiny, q8)…");
const yolo = await withRetry(() => pipeline("object-detection", "Xenova/yolos-tiny", { dtype: "q8" }), "yolo");
console.log(`YOLO loaded in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

for (const f of ["traffic-jam-640.jpg", "traffic-jam-2-640.jpg"]) {
  const t = Date.now();
  const image = await RawImage.read(`/home/z/my-project/scripts/models/${f}`);
  const dets = await yolo(image, { threshold: 0.35, percentage: true });
  const counts = {};
  for (const d of dets) counts[d.label] = (counts[d.label] ?? 0) + 1;
  console.log(`\n${f} (${((Date.now() - t) / 1000).toFixed(2)}s):`);
  console.log("  detections:", JSON.stringify(counts), "raw:", dets.length);
}

console.log("\nALL MODEL CHECKS DONE");
