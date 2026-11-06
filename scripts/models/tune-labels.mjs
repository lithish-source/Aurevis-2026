// Label-tuning experiment for the BERT zero-shot classifier.
import { pipeline, env } from "@huggingface/transformers";

env.cacheDir = "/home/z/my-project/.models";
env.allowLocalModels = false;

const zero = await pipeline("zero-shot-classification", "Xenova/distilbert-base-uncased-mnli", { dtype: "q8" });

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

const CONFIGS = [
  {
    name: "A: noun labels + template, single",
    multi_label: false,
    template: "The report describes {}.",
    types: ["a vehicle crash", "a flooded road", "a traffic jam", "a train or bus service problem", "a road closure", "broken public infrastructure", "a public demonstration", "a fire or electrical hazard"],
    keys: ["accident", "flood", "congestion", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard"],
  },
  {
    name: "B: noun labels, multi-label",
    multi_label: true,
    template: "The report describes {}.",
    types: ["a vehicle crash", "a flooded road", "a traffic jam", "a train or bus service problem", "a road closure", "broken public infrastructure", "a public demonstration", "a fire or electrical hazard"],
    keys: ["accident", "flood", "congestion", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard"],
  },
  {
    name: "C: plain nouns, multi-label",
    multi_label: true,
    template: "This text is about {}.",
    types: ["a vehicle crash", "a flooded road", "a traffic jam", "a train or bus service problem", "a road closure", "broken public infrastructure", "a public demonstration", "a fire or electrical hazard"],
    keys: ["accident", "flood", "congestion", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard"],
  },
];

const SEV_CONFIGS = [
  {
    name: "S1: ladder, multi",
    multi_label: true,
    template: "The situation is {}.",
    labels: ["a life-threatening emergency", "a serious disruption", "a noticeable delay", "a trivial problem"],
    keys: ["critical", "high", "medium", "low"],
  },
  {
    name: "S2: ladder, single",
    multi_label: false,
    template: "The situation is {}.",
    labels: ["a life-threatening emergency", "a serious disruption", "a noticeable delay", "a trivial problem"],
    keys: ["critical", "high", "medium", "low"],
  },
  {
    name: "S3: plain, multi",
    multi_label: true,
    template: "This text is about {}.",
    labels: ["a deadly emergency", "a major blockage", "a moderate delay", "a minor issue"],
    keys: ["critical", "high", "medium", "low"],
  },
];

for (const cfg of CONFIGS) {
  let hits = 0;
  const detail = [];
  for (const [text, expType] of GOLD) {
    const r = await zero(text, cfg.types, { multi_label: cfg.multi_label, hypothesis_template: cfg.template });
    // result sorted desc; map back through original label index
    const top = r.labels[0];
    const idx = cfg.types.indexOf(top);
    const got = cfg.keys[idx];
    if (got === expType) hits++;
    detail.push(`${got === expType ? "✓" : "✗"}${got}(${(r.scores[0] * 100).toFixed(0)})`);
  }
  console.log(`${cfg.name}: TYPE ${hits}/${GOLD.length}  ${detail.join(" ")}`);
}

for (const cfg of SEV_CONFIGS) {
  let hits = 0;
  const detail = [];
  for (const [text, , expSev] of GOLD) {
    const r = await zero(text, cfg.labels, { multi_label: cfg.multi_label, hypothesis_template: cfg.template });
    const top = r.labels[0];
    const idx = cfg.labels.indexOf(top);
    const got = cfg.keys[idx];
    if (got === expSev) hits++;
    detail.push(`${got === expSev ? "✓" : "✗"}${got}(${(r.scores[0] * 100).toFixed(0)})`);
  }
  console.log(`${cfg.name}: SEV ${hits}/${GOLD.length}  ${detail.join(" ")}`);
}
