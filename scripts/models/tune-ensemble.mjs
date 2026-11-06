// Round 3: ensemble = domain lexicon (from classify.ts) + BERT zero-shot.
import { pipeline, env } from "@huggingface/transformers";

env.cacheDir = "/home/z/my-project/.models";
env.allowLocalModels = false;

const zero = await pipeline("zero-shot-classification", "Xenova/distilbert-base-uncased-mnli", { dtype: "q8" });

// ── copied from src/lib/social/classify.ts (keep in sync) ──
const TYPE_KEYWORDS = [
  ["flood", /waterlog|flood|inundat|knee[- ]deep|submerged|breach|overflow|water on (the )?road|sheet of water|water pool/i],
  ["accident", /accident|crash|collid|rammed|hit (a|an|the|my)|overturn|topple|lorry|ambulance|casualt|injur|bleeding|skid/i],
  ["protest", /protest|strike|bandh|road roko|blockade|dharna|rally|morcha|demonstration/i],
  ["hazard", /fire|smoke|gas leak|electrocut|live wire|open (manhole|drain)|tree branch hang|short circuit|transformer/i],
  ["transit_disruption", /(metro|train|mtc|bus).{0,40}(delay|held|hold|cancel|suspend|stuck|breakdown|not (moving|running)|divert|short terminat|pack|crowd)|(delay|held|cancel|suspend|stuck|breakdown|divert).{0,40}(metro|train|mtc|bus)/i],
  ["road_closure", /(road|route|stretch|bridge|flyover).{0,30}(closed|closure|blocked|barricad|shut|divert)|diversion|no entry/i],
  ["infrastructure", /pothole|tree (fell|uprooted)|signal (not|down|failed)|streetlight|power cut|power failure|pipe burst|sewage|crack(ed)? (road|bridge)|water supply/i],
  ["congestion", /traffic|jam|crawl|bumper to bumper|stuck (in|at)|heavy (traffic|jam)|gridlock|slow[- ]moving|long (queue|line)|snarl|standstill|crawling/i],
];
const CRIT_RE = /trapped|stranded inside|died|dead|death|casualt|fatal|electrocut|evacuat|completely (submerged|shut|closed)|collapsed|engulfed/i;
const HIGH_RE = /injur|bleeding|hospital|knee[- ]deep|waist[- ]deep|shut (down|for)|suspend|major|hours|severe|rescue|fire/i;

const BERT_TYPES = ["a vehicle crash", "a waterlogged flooded road", "slow bumper-to-bumper traffic", "a metro train or bus service disruption", "a road blocked by barricades or police", "a pothole or faulty traffic signal", "a public demonstration or strike", "a fire smoke or electrical hazard"];
const BERT_TYPE_KEYS = ["accident", "flood", "congestion", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard"];
const SEV_LABELS = ["a deadly emergency", "a major blockage", "a moderate delay", "a minor issue"];
const SEV_KEYS = ["critical", "high", "medium", "low"];
const SEV_W = { low: 0.2, medium: 0.45, high: 0.72, critical: 0.9 };

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
  ["Signal not working at the junction, everyone crossing at once, total chaos", "infrastructure", "medium"],
  ["MTC buses on this route are cancelled today, huge crowd waiting at the stop", "transit_disruption", "medium"],
  [" autos are not going through this stretch, water everywhere on the road", "flood", "medium"],
  ["Everyone standing still on the flyover, no movement at all for half an hour", "congestion", "medium"],
];

let typeHits = 0, sevHits = 0;
for (const [text, expType, expSev] of GOLD) {
  // keyword type
  const kwType = TYPE_KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? null;
  // BERT type
  const tr = await zero(text, BERT_TYPES, { multi_label: true, hypothesis_template: "The report describes {}." });
  const bertType = BERT_TYPE_KEYS[BERT_TYPES.indexOf(tr.labels[0])];
  const finalType = kwType ?? bertType;
  // BERT severity (normalized weighted)
  const sr = await zero(text, SEV_LABELS, { multi_label: true, hypothesis_template: "This text is about {}." });
  const probs = SEV_KEYS.map((k) => sr.scores[sr.labels.indexOf(SEV_LABELS[SEV_KEYS.indexOf(k)])] ?? 0);
  const sum = probs.reduce((a, b) => a + b, 0) || 1;
  let textScore = SEV_KEYS.reduce((acc, k, i) => acc + (probs[i] / sum) * SEV_W[k], 0);
  // keyword severity floors (safety-first)
  if (CRIT_RE.test(text)) textScore = Math.max(textScore, 0.86);
  else if (HIGH_RE.test(text)) textScore = Math.max(textScore, 0.68);
  const gotSev = textScore < 0.4 ? "low" : textScore < 0.6 ? "medium" : textScore < 0.78 ? "high" : "critical";
  const tOk = finalType === expType, sOk = gotSev === expSev;
  typeHits += tOk; sevHits += sOk;
  console.log(`${tOk ? "✓" : "✗"}${sOk ? "✓" : "✗"} ${finalType.padEnd(18)} ${gotSev.padEnd(8)} score=${textScore.toFixed(2)} [kw:${kwType ?? "-"} bert:${bertType}] "${text.slice(0, 40)}"`);
}
console.log(`\nENSEMBLE: TYPE ${typeHits}/${GOLD.length}  SEV ${sevHits}/${GOLD.length}`);
