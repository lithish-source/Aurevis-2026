// ─────────────────────────────────────────────────────────────────────────────
// Mobility-event NLP classifier.
//
// Primary engine: z-ai-web-dev-sdk LLM (server-side only) with a strict JSON
// contract — mobility relevance, event type, severity, sentiment, place/time
// mentions. Fallback engine: transparent keyword heuristics, so the pipeline
// keeps working even when the LLM is slow or unavailable (both engines are
// recorded per post in nlpMeta.engine).

import ZAI from "z-ai-web-dev-sdk";

export const EVENT_TYPES = [
  "congestion",
  "accident",
  "flood",
  "transit_disruption",
  "road_closure",
  "infrastructure",
  "protest",
  "hazard",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SENTIMENTS = ["negative", "neutral", "positive"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export type ClassifyInput = { id: string; text: string; source?: string };

export type Classification = {
  isMobility: boolean;
  eventType: EventType;
  severity: Severity;
  sentiment: Sentiment;
  locations: string[];
  timeRefs: string[];
  summary: string;
};

export type ClassifyResult = Classification & { engine: "llm" | "heuristic" };

const SYSTEM_PROMPT = `You are the NLP engine of a city mobility-intelligence system for Chennai, India.
You classify social media posts about city transport, weather and street conditions.

For each post return strict JSON (no markdown, no commentary) with exactly these fields:
- "i": the post index number you were given
- "mob": true if the post describes a real, current/recent mobility-related happening in or around Chennai
  (traffic, accidents, flooding/waterlogging, metro/bus/train disruptions, road closures, damaged
  infrastructure, protests affecting movement, hazards). false for opinions without events, memes,
  food/entertainment/sports chatter, ads, and non-Chennai content.
- "type": one of congestion | accident | flood | transit_disruption | road_closure | infrastructure | protest | hazard | other
- "sev": one of low | medium | high | critical
  (critical = trapped people, casualties, fire, evacuation, complete shutdown;
  high = major disruption, injuries, deep water, corridor-level failure;
  medium = notable but localized delay/diversion; low = minor/short-lived)
- "sent": one of negative | neutral | positive (the author's tone about the situation)
- "locs": array of Chennai place mentions found in the text (roads, junctions, stations, neighbourhoods;
  verbatim from the text, [] if none)
- "time": array of time references verbatim (e.g. "since 5pm", "20 mins") , [] if none
- "sum": one short sentence (max 12 words) summarising the event

Respond with a JSON array, one object per post, in the same order.`;

// ── heuristic fallback ───────────────────────────────────────────────────────

const TYPE_KEYWORDS: Array<[EventType, RegExp]> = [
  ["flood", /waterlog|flood|inundat|knee[- ]deep|submerged|breach|overflow|water on (the )?road|sheet of water/i],
  ["accident", /accident|crash|collid|rammed|hit (a|an|the|my)|overturn|topple|lorry|ambulance|casualt|injur|bleeding/i],
  ["protest", /protest|strike|bandh|road roko|blockade|dharna|rally|morcha/i],
  ["hazard", /fire|smoke|gas leak|electrocut|live wire|open (manhole|drain)|tree branch hang|short circuit/i],
  ["transit_disruption", /(metro|train|mtc|bus).{0,40}(delay|held|hold|cancel|suspend|stuck|breakdown|not (moving|running)|divert|short terminat|pack|crowd)|(delay|held|cancel|suspend|stuck|breakdown|divert).{0,40}(metro|train|mtc|bus)/i],
  ["road_closure", /(road|route|stretch|bridge|flyover).{0,30}(closed|closure|blocked|barricad|shut|divert)|diversion|no entry/i],
  ["infrastructure", /pothole|tree (fell|uprooted)|signal (not|down|failed)|streetlight|power cut|power failure|pipe burst|sewage|crack(ed)? (road|bridge)|water supply/i],
  ["congestion", /traffic|jam|crawl|bumper to bumper|stuck (in|at)|heavy (traffic|jam)|gridlock|slow[- ]moving|long (queue|line)|snarl|standstill|crawling/i],
];

const SEV_RULES: Array<[Severity, RegExp]> = [
  ["critical", /trapped|stranded inside|died|dead|death|casualt|fatal|electrocut|evacuat|completely (submerged|shut|closed)|collapsed|engulfed/i],
  ["high", /injur|bleeding|hospital|knee[- ]deep|waist[- ]deep|shut (down|for)|suspend|major|hours|severe|rescue|fire/i],
  ["medium", /slow|delay|divert|moderate|queue|crawl|barricad|blocked lane|partial/i],
  ["low", /minor|slight|brief|few minutes|small|light/i],
];

const NEG = /stuck|worst|terrible|horrible|awful|angry|frustrat|annoy|pathetic|sad|scary|dangerous|disgusting|nightmare|exhaust|panic|helpless|fed up/i;
const POS = /cleared|normal|resum|smooth|thanks|good|great|appreciat|relief|reopened|back on track|on time|quick/i;

export function heuristicClassify(text: string): Classification {
  const type = TYPE_KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? "other";
  const mobilityish = type !== "other" || /traffic|bus|metro|train|road|waterlog|jam|flood/i.test(text);
  let severity: Severity = "medium";
  for (const [sev, re] of SEV_RULES) {
    if (re.test(text)) {
      severity = sev;
      break;
    }
  }
  const sentiment: Sentiment = POS.test(text) && !NEG.test(text) ? "positive" : NEG.test(text) ? "negative" : "neutral";
  return {
    isMobility: mobilityish,
    eventType: type,
    severity,
    sentiment,
    locations: [],
    timeRefs: text.match(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\b\d+\s?(min|mins|minutes|hr|hrs|hours)\b/gi) ?? [],
    summary: text.split(/[.!?\n]/)[0]?.slice(0, 90) ?? text.slice(0, 90),
  };
}

// ── LLM engine ───────────────────────────────────────────────────────────────

function parseLlmJson(raw: string): Array<Record<string, unknown>> {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

function coerceClassification(raw: Record<string, unknown>): Classification | null {
  const type = String(raw.type ?? "other").toLowerCase().replace(/[\s-]+/g, "_");
  const sev = String(raw.sev ?? raw.severity ?? "medium").toLowerCase();
  const sent = String(raw.sent ?? raw.sentiment ?? "neutral").toLowerCase();
  const locs = Array.isArray(raw.locs) ? raw.locs.map((l) => String(l)).filter(Boolean) : [];
  const timeRefs = Array.isArray(raw.time) ? raw.time.map((l) => String(l)).filter(Boolean) : [];
  const summary = String(raw.sum ?? raw.summary ?? "").slice(0, 140);
  if (!EVENT_TYPES.includes(type as EventType)) return null;
  return {
    isMobility: Boolean(raw.mob ?? raw.isMobility),
    eventType: type as EventType,
    severity: (SEVERITIES.includes(sev as Severity) ? sev : "medium") as Severity,
    sentiment: (SENTIMENTS.includes(sent as Sentiment) ? sent : "neutral") as Sentiment,
    locations: locs.slice(0, 6),
    timeRefs: timeRefs.slice(0, 4),
    summary,
  };
}

async function llmClassifyBatch(posts: ClassifyInput[], timeoutMs: number): Promise<Map<string, Classification>> {
  const out = new Map<string, Classification>();
  const zai = await ZAI.create();
  const userMsg = posts
    .map((p, i) => `#${i} [${p.source ?? "social"}] ${p.text.replace(/\s+/g, " ").slice(0, 600)}`)
    .join("\n\n");

  const completion = (await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        { role: "user", content: `Classify these ${posts.length} posts:\n\n${userMsg}` },
      ],
      thinking: { type: "disabled" },
    }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("llm timeout")), timeoutMs)),
  ])) as { choices?: Array<{ message?: { content?: string } }> };

  const content = completion.choices?.[0]?.message?.content ?? "";
  const arr = parseLlmJson(content);
  posts.forEach((p, i) => {
    const hit = arr.find((o) => Number(o.i) === i);
    const c = hit ? coerceClassification(hit) : null;
    if (c) out.set(p.id, c);
  });
  return out;
}

/**
 * Classify a list of posts. Tries the LLM in small batches (with one retry),
 * and silently falls back to keyword heuristics per post. Each result records
 * which engine produced it.
 */
export async function classifyPosts(posts: ClassifyInput[], opts: { timeoutMs?: number; batchSize?: number } = {}): Promise<Map<string, ClassifyResult>> {
  const { timeoutMs = 45_000, batchSize = 8 } = opts;
  const results = new Map<string, ClassifyResult>();

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    let llmResults: Map<string, Classification> | null = null;
    try {
      llmResults = await llmClassifyBatch(batch, timeoutMs);
    } catch {
      try {
        llmResults = await llmClassifyBatch(batch, timeoutMs);
      } catch {
        llmResults = null;
      }
    }
    for (const p of batch) {
      const c = llmResults?.get(p.id);
      if (c) {
        results.set(p.id, { ...c, engine: "llm" });
      } else {
        results.set(p.id, { ...heuristicClassify(p.text), engine: "heuristic" });
      }
    }
  }
  return results;
}

export async function classifyPost(post: ClassifyInput, opts?: { timeoutMs?: number }): Promise<ClassifyResult> {
  const r = await classifyPosts([post], opts);
  return r.get(post.id) ?? { ...heuristicClassify(post.text), engine: "heuristic" };
}
