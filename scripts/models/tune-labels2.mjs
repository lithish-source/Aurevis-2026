// Label-tuning round 2: refined labels + premise anchoring.
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
  ["Signal not working at the junction, everyone crossing at once, total chaos", "infrastructure", "medium"],
  ["MTC buses on this route are cancelled today, huge crowd waiting at the stop", "transit_disruption", "medium"],
];

const TYPES = {
  T1: {
    labels: ["a vehicle crash", "a waterlogged flooded road", "slow bumper-to-bumper traffic", "a metro train or bus service disruption", "a road blocked by barricades or police", "a pothole or faulty traffic signal", "a public demonstration or strike", "a fire smoke or electrical hazard"],
    keys: ["accident", "flood", "congestion", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard"],
  },
  T2: {
    labels: ["an accident", "flooding", "a traffic jam", "a transit outage", "a road closure", "a pothole", "a protest", "a hazard"],
    keys: ["accident", "flood", "congestion", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard"],
  },
};
const TEMPLATES = ["This text is about {}.", "The commuter is reporting {}.", "The report describes {}."];

const SEVS = {
  S3: { labels: ["a deadly emergency", "a major blockage", "a moderate delay", "a minor issue"], keys: ["critical", "high", "medium", "low"] },
  S4: { labels: ["an emergency with lives at risk", "a severe disruption", "a significant delay", "a small problem"], keys: ["critical", "high", "medium", "low"] },
};

for (const [tName, cfg] of Object.entries(TYPES)) {
  for (const template of TEMPLATES) {
    let hits = 0;
    const detail = [];
    for (const [text, expType] of GOLD) {
      const r = await zero(text, cfg.labels, { multi_label: true, hypothesis_template: template });
      const idx = cfg.labels.indexOf(r.labels[0]);
      const got = cfg.keys[idx];
      if (got === expType) hits++;
      detail.push(`${got === expType ? "✓" : "✗"}${got}`);
    }
    console.log(`${tName} "${template}": TYPE ${hits}/${GOLD.length}  ${detail.join(" ")}`);
  }
}

for (const [sName, cfg] of Object.entries(SEVS)) {
  for (const template of TEMPLATES.slice(0, 2)) {
    let hits = 0;
    const detail = [];
    for (const [text, , expSev] of GOLD) {
      const r = await zero(text, cfg.labels, { multi_label: true, hypothesis_template: template });
      const idx = cfg.labels.indexOf(r.labels[0]);
      const got = cfg.keys[idx];
      if (got === expSev) hits++;
      detail.push(`${got === expSev ? "✓" : "✗"}${got}`);
    }
    console.log(`${sName} "${template}": SEV ${hits}/${GOLD.length}  ${detail.join(" ")}`);
  }
}
