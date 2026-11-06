// ─────────────────────────────────────────────────────────────────────────────
// Citizen-report AI: Hybrid Multimodal API + Local BERT & YOLO Backup.
//
// For "See something? Report it":
//
// 1. PRIMARY: Multimodal AI API (Gemini / OpenAI GPT-4o-mini).
//    When an API key is available (GEMINI_API_KEY / GOOGLE_API_KEY / OPENAI_API_KEY),
//    the report description AND photo are analysed jointly by a frontier vision model:
//    - Real visual understanding (water depth on tires, vehicle crash damage,
//      traffic gridlock, structural blockages) rather than mere object counts.
//    - Deep understanding of Chennai transit nuances and colloquial phrasing.
//
// 2. BACKUP: On-Server Local BERT + YOLO (100% offline, ₹0, no API keys).
//    When no API key is configured or if the cloud API times out:
//    • BERT — Xenova/distilbert-base-uncased-mnli (DistilBERT zero-shot)
//      runs over the text description (event type + severity distribution).
//    • YOLO — Xenova/yolos-tiny scans the photo for vehicle/pedestrian counts.
//    • Domain Lexicon & Safety Floors — hand-tuned for Chennai transit.
//    • Fusion: max(textScore, imageScore × 0.80) — photos can escalate,
//      never downgrade, verbal reports.
//
// All verdicts travel with engine indicators (engines.api vs bert/yolo) and
// are stored in nlpMeta.ai for auditing in the CUMTA admin console.

import { heuristicClassify, EVENT_TYPES, SEVERITIES, type Severity, type EventType } from "@/lib/social/classify";

// ── public types ─────────────────────────────────────────────────────────────

export type CitizenAIEngines = {
  bert: boolean;
  yolo: boolean;
  lexicon: boolean;
  api?: boolean;
  provider?: "gemini" | "groq" | "openai" | "fallback";
};

export type CitizenAIText = {
  eventType: EventType;
  /** which engine decided the event type */
  typeSource: "lexicon" | "bert" | "api";
  /** 0–1 severity score implied by the description alone */
  textScore: number;
  bert: {
    typeLabel: string;
    typeConfidence: number;
    severityLabel: Severity;
    severityProbs: Record<Severity, number>;
  } | null;
};

export type CitizenAIImage = {
  /** counted detections, most numerous first */
  objects: Array<{ label: string; count: number }>;
  vehicleCount: number;
  personCount: number;
  heavyCount: number;
  vulnerableCount: number;
  rawDetections: number;
  /** 0–1 severity score implied by the photo alone (pre-fusion) */
  imageScore: number;
};

export type CitizenAIResult = {
  engines: CitizenAIEngines;
  text: CitizenAIText;
  image: CitizenAIImage | null;
  severity: Severity;
  finalScore: number;
  mismatch?: {
    detected: boolean;
    reason: string;
  } | null;
};

// ── calibration (validated on a 14-case gold set, see scripts/models/) ───────

const SEV_WEIGHT: Record<Severity, number> = { low: 0.15, medium: 0.4, high: 0.64, critical: 0.88 };
const FLOOR_CRITICAL = /trapped|stranded inside|died|dead|death|casualt|fatal|electrocut|evacuat|completely (submerged|shut|closed)|collapsed|engulfed/i;
const FLOOR_HIGH = /injur|bleeding|hospital|knee[- ]deep|waist[- ]deep|shut (down|for)|suspend|major|hours|severe|rescue|fire/i;

export function scoreToSeverity(score: number): Severity {
  if (score < 0.38) return "low";
  if (score < 0.57) return "medium";
  if (score < 0.78) return "high";
  return "critical";
}

// ── zero-shot label banks (phrasings validated in scripts/models/tune-*.mjs) ─

const BERT_TYPE_LABELS = [
  "a vehicle crash",
  "a waterlogged flooded road",
  "slow bumper-to-bumper traffic",
  "a metro train or bus service disruption",
  "a road blocked by barricades or police",
  "a pothole or faulty traffic signal",
  "a public demonstration or strike",
  "a fire smoke or electrical hazard",
];
const BERT_TYPE_KEYS: EventType[] = ["accident", "flood", "congestion", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard"];
const BERT_SEV_LABELS = ["a deadly emergency", "a major blockage", "a moderate delay", "a minor issue"];
const BERT_SEV_KEYS: Severity[] = ["critical", "high", "medium", "low"];

// ── YOLO scene scoring (COCO classes yolos-tiny knows) ───────────────────────

const VEHICLE_CLASSES = new Set(["car", "bus", "truck", "motorcycle", "bicycle", "train"]);
const HEAVY_CLASSES = new Set(["bus", "truck"]);
const VULNERABLE_CLASSES = new Set(["motorcycle", "bicycle"]);
const ALLOWED_TRANSIT_CLASSES = new Set([
  "person",
  "car",
  "bus",
  "truck",
  "motorcycle",
  "bicycle",
  "train",
  "traffic light",
  "fire hydrant",
  "stop sign",
]);

/** Non-Maximum Suppression: eliminates duplicate bounding boxes on the same person or vehicle */
function runNMS(
  detections: Array<{ label: string; score: number; box?: { xmin: number; ymin: number; xmax: number; ymax: number } }>,
  iouThreshold = 0.35,
) {
  const byLabel = new Map<string, typeof detections>();
  for (const d of detections) {
    if (!byLabel.has(d.label)) byLabel.set(d.label, []);
    byLabel.get(d.label)!.push(d);
  }

  const kept: typeof detections = [];

  for (const [, list] of byLabel) {
    list.sort((a, b) => b.score - a.score);
    const suppressed = new Set<number>();

    for (let i = 0; i < list.length; i++) {
      if (suppressed.has(i)) continue;
      const best = list[i];
      kept.push(best);
      if (!best.box) continue;

      for (let j = i + 1; j < list.length; j++) {
        if (suppressed.has(j)) continue;
        const other = list[j];
        if (!other.box) continue;

        const x1 = Math.max(best.box.xmin, other.box.xmin);
        const y1 = Math.max(best.box.ymin, other.box.ymin);
        const x2 = Math.min(best.box.xmax, other.box.xmax);
        const y2 = Math.min(best.box.ymax, other.box.ymax);
        const interW = Math.max(0, x2 - x1);
        const interH = Math.max(0, y2 - y1);
        const interArea = interW * interH;

        const a1 = (best.box.xmax - best.box.xmin) * (best.box.ymax - best.box.ymin);
        const a2 = (other.box.xmax - other.box.xmin) * (other.box.ymax - other.box.ymin);
        const unionArea = a1 + a2 - interArea;

        const iou = unionArea > 0 ? interArea / unionArea : 0;
        if (iou > iouThreshold) {
          suppressed.add(j);
        }
      }
    }
  }

  return kept;
}

function yoloSceneScore(vehicleCount: number, personCount: number, heavyCount: number, vulnerableCount: number): number {
  // If no vehicles and only a few people (e.g. indoor scene or selfie), baseline score
  if (vehicleCount === 0 && personCount <= 4) {
    return 0.05;
  }
  let base = 0.05;
  if (vehicleCount >= 31) base = 0.78;
  else if (vehicleCount >= 16) base = 0.66;
  else if (vehicleCount >= 6) base = 0.5;
  else if (vehicleCount >= 1) base = 0.25;
  let score = base;
  if (heavyCount >= 2) score += 0.08;
  if (personCount >= 8) score += 0.08;
  if (vulnerableCount >= 2) score += 0.05;
  return Math.min(0.92, score);
}

// ── model singletons (lazy, retry-aware — HF rate-limits anonymous pulls) ────

type Pipe = (text: string, labels: string[], opts?: Record<string, unknown>) => Promise<{ labels: string[]; scores: number[] }>;
type DetPipe = (image: unknown, opts?: Record<string, unknown>) => Promise<Array<{ label: string; score: number }>>;

// The singletons live on globalThis so Turbopack HMR re-evaluations of this
// module reuse the SAME loaded models instead of piling up 400 MB copies
// (duplicate loads once OOM-killed the dev server).
const G = globalThis as typeof globalThis & {
  __citizenAI?: {
    transformers: typeof import("@huggingface/transformers") | null;
    bert: Promise<Pipe> | null;
    yolo: Promise<DetPipe> | null;
  };
};
function slots() {
  G.__citizenAI ??= { transformers: null, bert: null, yolo: null };
  return G.__citizenAI!;
}

async function getTransformers() {
  const s = slots();
  if (!s.transformers) {
    s.transformers = await import("@huggingface/transformers");
    const env = s.transformers.env;
    env.cacheDir = process.env.HF_CACHE_DIR ?? `${process.cwd()}/.models`;
    env.allowLocalModels = false; // first run fetches from the HF hub, then disk-cached
  }
  return s.transformers;
}

async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 3, backoffMs = 20_000): Promise<T> {
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      console.error(`[citizen-ai] ${label} load attempt ${i}/${tries} failed: ${msg.slice(0, 160)}`);
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw new Error("unreachable");
}

function loadBert(): Promise<Pipe> {
  const s = slots();
  s.bert ??= (async () => {
    const { pipeline } = await getTransformers();
    const make = (dtype?: string) =>
      pipeline("zero-shot-classification", "Xenova/distilbert-base-uncased-mnli", (dtype ? { dtype } : undefined) as never) as unknown as Promise<Pipe>;
    try {
      return await withRetry(() => make("q8"), "bert-q8");
    } catch {
      return await withRetry(() => make(), "bert-default");
    }
  })().catch((e) => {
    slots().bert = null; // allow a later request to retry
    throw e;
  });
  return s.bert;
}

function loadYolo(): Promise<DetPipe> {
  const s = slots();
  s.yolo ??= (async () => {
    const { pipeline } = await getTransformers();
    const make = (dtype?: string) =>
      pipeline("object-detection", "Xenova/yolos-tiny", (dtype ? { dtype } : undefined) as never) as unknown as Promise<DetPipe>;
    try {
      return await withRetry(() => make("q8"), "yolo-q8");
    } catch {
      return await withRetry(() => make(), "yolo-default");
    }
  })().catch((e) => {
    slots().yolo = null;
    throw e;
  });
  return s.yolo;
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms}ms`)), ms))]);
}

// ── text analysis ─────────────────────────────────────────────────────────────

async function analyzeText(text: string): Promise<CitizenAIText> {
  const lex = heuristicClassify(text);
  let bert: CitizenAIText["bert"] = null;
  let textScore: number | null = null;

  try {
    const zero = await withTimeout(loadBert(), 60_000, "bert load");
    const typeRun = await withTimeout(
      zero(text, BERT_TYPE_LABELS, { multi_label: true, hypothesis_template: "The report describes {}." }) as Promise<{ labels: string[]; scores: number[] }>,
      25_000,
      "bert type pass",
    );
    const sevRun = await withTimeout(
      zero(text, BERT_SEV_LABELS, { multi_label: true, hypothesis_template: "This text is about {}." }) as Promise<{ labels: string[]; scores: number[] }>,
      25_000,
      "bert severity pass",
    );

    const typeIdx = BERT_TYPE_LABELS.indexOf(typeRun.labels[0]);
    const bertType = BERT_TYPE_KEYS[typeIdx] ?? "other";

    // normalised severity distribution → weighted score
    const probs: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    let sum = 0;
    BERT_SEV_KEYS.forEach((k, idx) => {
      const i = sevRun.labels.indexOf(BERT_SEV_LABELS[idx]);
      probs[k] = i >= 0 ? sevRun.scores[i] : 0;
      sum += probs[k];
    });
    const norm = sum > 0 ? sum : 1;
    textScore = BERT_SEV_KEYS.reduce((acc, k) => acc + (probs[k] / norm) * SEV_WEIGHT[k], 0);
    const bertSevLabel = BERT_SEV_KEYS.reduce((a, b) => (probs[a] >= probs[b] ? a : b));

    bert = {
      typeLabel: typeRun.labels[0],
      typeConfidence: typeRun.scores[0],
      severityLabel: bertSevLabel,
      severityProbs: {
        low: probs.low ?? 0,
        medium: probs.medium ?? 0,
        high: probs.high ?? 0,
        critical: probs.critical ?? 0,
      },
    };

    // lexicon wins when it fires (hand-tuned domain vocabulary); BERT is the
    // semantic fallback for phrasings the lexicon does not know
    if (lex.eventType && lex.eventType !== "other") {
      return { eventType: lex.eventType, typeSource: "lexicon", textScore, bert };
    }
    return { eventType: bertType, typeSource: "bert", textScore, bert };
  } catch (e) {
    console.error("[citizen-ai] BERT unavailable, lexicon-only:", e instanceof Error ? e.message.slice(0, 120) : e);
  }

  // lexicon-only fallback severity
  const lexScore: Record<Severity, number> = { low: 0.2, medium: 0.45, high: 0.62, critical: 0.86 };
  const lexType = lex.eventType && lex.eventType !== "other" ? lex.eventType : "other";
  return { eventType: lexType as EventType, typeSource: "lexicon", textScore: lexScore[lex.severity], bert: null };
}

// ── image analysis ─────────────────────────────────────────────────────────────

const IMAGE_MAGIC: Array<[Buffer, string]> = [
  [Buffer.from([0xff, 0xd8, 0xff]), "jpeg"],
  [Buffer.from([0x89, 0x50, 0x4e, 0x47]), "png"],
  [Buffer.from([0x52, 0x49, 0x46, 0x46]), "webp"],
];

function detectMimeType(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 4 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  return "image/jpeg";
}

export function decodeDataImage(dataUrlOrBase64: string): Buffer | null {
  const b64 = (dataUrlOrBase64.includes(",") ? dataUrlOrBase64.split(",")[1] : dataUrlOrBase64).trim();
  const buf = Buffer.from(b64, "base64");
  if (buf.length === 0 || buf.length > 4 * 1024 * 1024) return null; // 4 MB cap
  const ok = IMAGE_MAGIC.some(([magic]) => buf.subarray(0, magic.length).equals(magic));
  return ok ? buf : null;
}

async function analyzeImage(imageBuf: Buffer): Promise<CitizenAIImage | null> {
  let tmpPath: string | null = null;
  try {
    const { RawImage } = await getTransformers();
    const detector = await withTimeout(loadYolo(), 60_000, "yolo load");
    const { writeFile, unlink, mkdtemp } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const dir = await mkdtemp(join(tmpdir(), "citizen-yolo-"));
    const photoPath = join(dir, "photo.img");
    tmpPath = photoPath;
    await writeFile(photoPath, imageBuf);
    const image = await RawImage.read(photoPath);
    const rawDets = await withTimeout(
      detector(image, { threshold: 0.55, percentage: true }) as Promise<
        Array<{ label: string; score: number; box?: { xmin: number; ymin: number; xmax: number; ymax: number } }>
      >,
      60_000,
      "yolo inference",
    );

    // Filter out non-transit classes (discard noisy "tie", "tv", "bottle", "couch", etc.)
    const filteredDets = rawDets.filter((d) => ALLOWED_TRANSIT_CLASSES.has(d.label));

    // Non-Maximum Suppression: collapses duplicate bounding boxes on the same person/vehicle
    const dets = runNMS(filteredDets, 0.35);

    const counts = new Map<string, number>();
    for (const d of dets) counts.set(d.label, (counts.get(d.label) ?? 0) + 1);
    const vehicleCount = [...counts.entries()].filter(([l]) => VEHICLE_CLASSES.has(l)).reduce((a, [, c]) => a + c, 0);
    const personCount = counts.get("person") ?? 0;
    const heavyCount = [...counts.entries()].filter(([l]) => HEAVY_CLASSES.has(l)).reduce((a, [, c]) => a + c, 0);
    const vulnerableCount = [...counts.entries()].filter(([l]) => VULNERABLE_CLASSES.has(l)).reduce((a, [, c]) => a + c, 0);

    return {
      objects: [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      vehicleCount,
      personCount,
      heavyCount,
      vulnerableCount,
      rawDetections: dets.length,
      imageScore: yoloSceneScore(vehicleCount, personCount, heavyCount, vulnerableCount),
    };
  } catch (e) {
    console.error("[citizen-ai] YOLO unavailable, text-only scoring:", e instanceof Error ? e.message.slice(0, 120) : e);
    return null;
  } finally {
    const p = tmpPath;
    if (p) await import("fs/promises").then((fs) => fs.unlink(p).catch(() => undefined));
  }
}

// ── multimodal API integration (primary with local fallback) ───────────────

const MULTIMODAL_PROMPT = `You are the AI transit incident severity and event classifier for Chennai One (CUMTA incident operations console in Chennai, India).
Analyze the commuter's incident report (text description and optional scene photo).

Classify:
1. "eventType": exactly one of "congestion", "accident", "flood", "transit_disruption", "road_closure", "infrastructure", "protest", "hazard", "other".
2. "severity": exactly one of "low", "medium", "high", "critical".
   - "critical" (score >= 0.78): Loss of life, casualties, trapped passengers, structural collapse, active fire/smoke, major road completely submerged or closed.
   - "high" (score 0.57 - 0.77): Major disruptions, knee-to-waist waterlogging causing bus diversions, overturned heavy vehicles, severe multilane crash, injured persons, suspended train/metro lines.
   - "medium" (score 0.38 - 0.56): Moderate jams (20-40 min delay), single lane blockage, minor road water accumulation where buses still pass, vehicle breakdown, traffic light signal failure.
   - "low" (score 0.05 - 0.37): Slight slow-moving traffic, minor water puddles, brief delay (< 10 min), minor pothole with smooth traffic.
3. "score": number from 0.05 to 1.0 (combined severity).
4. "textScore": number from 0.05 to 1.0 (implied by description alone).
5. "imageScore": number from 0.05 to 0.90 (implied by photo alone, null if no photo).
6. "confidence": number from 0.0 to 1.0.
7. "objects": array of objects detected in the photo (e.g. [{"label": "person", "count": 1}, {"label": "car", "count": 4}]). If a photo is attached, identify visible people, vehicles, or key objects; return [] only if no photo was attached.
8. "reasoning": short 1-sentence explanation of what you observed and why that severity was chosen.
9. "imageTextMatch": boolean (true if the attached photo plausibly depicts, supports, or relates to the described incident scene; false if the photo clearly contradicts or has zero relevance to the text — for example, an indoor selfie/room/ceiling/pet when a road accident, flood, or bus breakdown is reported; or a clear empty road when a massive disaster is claimed). If no photo is attached, return true.
10. "mismatchReason": string (if imageTextMatch is false, explain the contradiction in 1 sentence, e.g. "Description reports a severe bus collision, but the photo shows an indoor office room with no vehicles."; null if imageTextMatch is true).

Respond with ONLY a valid JSON object matching these fields, no markdown formatting.`;

function parseMultimodalResponse(
  rawText: string,
  text: string,
  image: Buffer | null | undefined,
  provider: "gemini" | "groq" | "openai",
): CitizenAIResult | null {
  try {
    let s = rawText.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();
    const parsed = JSON.parse(s);

    const typeStr = String(parsed.eventType ?? "").toLowerCase().replace(/[\s-]+/g, "_");
    const eventType: EventType = EVENT_TYPES.includes(typeStr as EventType)
      ? (typeStr as EventType)
      : heuristicClassify(text).eventType;

    let sevStr = String(parsed.severity ?? "").toLowerCase();
    let severity: Severity = SEVERITIES.includes(sevStr as Severity) ? (sevStr as Severity) : "medium";

    let score = Number(parsed.score);
    if (!Number.isFinite(score) || score <= 0 || score > 1) {
      score = SEV_WEIGHT[severity] ?? 0.5;
    }

    let textScore = Number(parsed.textScore);
    if (!Number.isFinite(textScore)) textScore = score;

    // Safety floors (Chennai transit guardrails)
    if (FLOOR_CRITICAL.test(text)) {
      textScore = Math.max(textScore, 0.85);
      score = Math.max(score, 0.85);
      severity = "critical";
    } else if (FLOOR_HIGH.test(text)) {
      textScore = Math.max(textScore, 0.6);
      score = Math.max(score, 0.6);
      if (severity === "low" || severity === "medium") severity = "high";
    }

    const objects: Array<{ label: string; count: number }> = Array.isArray(parsed.objects)
      ? parsed.objects
          .map((o: unknown) => {
            if (typeof o === "object" && o !== null) {
              const item = o as Record<string, unknown>;
              return { label: String(item.label || "").toLowerCase(), count: Math.max(1, Math.round(Number(item.count || 1))) };
            }
            return null;
          })
          .filter((o): o is { label: string; count: number } => Boolean(o && o.label))
          .slice(0, 8)
      : [];

    let vehicleCount = 0;
    let personCount = 0;
    let heavyCount = 0;
    let vulnerableCount = 0;

    for (const obj of objects) {
      if (VEHICLE_CLASSES.has(obj.label)) vehicleCount += obj.count;
      if (obj.label === "person" || obj.label === "people" || obj.label === "pedestrian") personCount += obj.count;
      if (HEAVY_CLASSES.has(obj.label)) heavyCount += obj.count;
      if (VULNERABLE_CLASSES.has(obj.label)) vulnerableCount += obj.count;
    }

    let imageScore = image ? Number(parsed.imageScore) : null;
    if (image && (!Number.isFinite(imageScore) || imageScore == null)) {
      imageScore = yoloSceneScore(vehicleCount, personCount, heavyCount, vulnerableCount);
    }
    const fusedImageScore = imageScore != null ? imageScore * 0.8 : null;
    let finalScore = fusedImageScore != null ? Math.max(textScore, fusedImageScore) : textScore;

    // Cross-modal consistency verification (detect fake dramatic reports with irrelevant photos)
    const imageTextMatch = image ? Boolean(parsed.imageTextMatch ?? true) : true;
    let mismatch: CitizenAIResult["mismatch"] = null;

    if (image && !imageTextMatch) {
      mismatch = {
        detected: true,
        reason: String(parsed.mismatchReason || "The attached photo does not match the described incident scene."),
      };
      // Anti-fraud mitigation: cap severity to unverified low
      finalScore = Math.min(finalScore, 0.35);
    }
    const finalSev = scoreToSeverity(finalScore);

    return {
      engines: { bert: false, yolo: false, lexicon: true, api: true, provider },
      text: {
        eventType,
        typeSource: "api",
        textScore,
        bert: {
          typeLabel: parsed.reasoning ? String(parsed.reasoning).slice(0, 90) : `AI Vision (${eventType})`,
          typeConfidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.95,
          severityLabel: finalSev,
          severityProbs: {
            low: finalSev === "low" ? 0.92 : 0.03,
            medium: finalSev === "medium" ? 0.92 : 0.03,
            high: finalSev === "high" ? 0.92 : 0.03,
            critical: finalSev === "critical" ? 0.92 : 0.03,
          },
        },
      },
      image: image
        ? {
            objects,
            vehicleCount,
            personCount,
            heavyCount,
            vulnerableCount,
            rawDetections: objects.reduce((a, b) => a + b.count, 0),
            imageScore: fusedImageScore ?? imageScore ?? 0.5,
          }
        : null,
      severity: finalSev,
      finalScore,
      mismatch,
    };
  } catch (e) {
    console.error("[citizen-ai] Failed to parse multimodal API response:", e);
    return null;
  }
}

async function callMultimodalApi(input: { text: string; image?: Buffer | null }): Promise<CitizenAIResult | null> {
  const groqKeys = [process.env.GROQ_API_KEY, process.env.GROQ_BACKUP_KEY].filter(Boolean) as string[];
  for (const groqKey of groqKeys) {
    const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const content: Array<Record<string, unknown>> = [
      { type: "text", text: `Commuter Description:\n"${input.text}"` },
    ];
    if (input.image) {
      const mime = detectMimeType(input.image);
      content.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${input.image.toString("base64")}` },
      });
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: MULTIMODAL_PROMPT },
            { role: "user", content },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const rawText = json.choices?.[0]?.message?.content;
        if (rawText) {
          const parsed = parseMultimodalResponse(rawText, input.text, input.image, "groq");
          if (parsed) return parsed;
        }
      } else if (res.status === 429) {
        console.warn(`[citizen-ai] Groq key rate limited (429), trying backup key if available...`);
        continue;
      } else {
        console.warn(`[citizen-ai] Groq API returned status ${res.status}: ${await res.text().catch(() => "")}`);
      }
    } catch (e) {
      console.warn("[citizen-ai] Groq API request failed:", e instanceof Error ? e.message : e);
    } finally {
      clearTimeout(timer);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    const parts: Array<Record<string, unknown>> = [
      { text: `${MULTIMODAL_PROMPT}\n\nCommuter Description:\n"${input.text}"` },
    ];
    if (input.image) {
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: input.image.toString("base64"),
        },
      });
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.1,
          },
        }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = parseMultimodalResponse(rawText, input.text, input.image, "gemini");
          if (parsed) return parsed;
        }
      } else {
        console.warn(`[citizen-ai] Gemini API returned status ${res.status}: ${await res.text().catch(() => "")}`);
      }
    } catch (e) {
      console.warn("[citizen-ai] Gemini API request failed:", e instanceof Error ? e.message : e);
    } finally {
      clearTimeout(timer);
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY || (process.env.VYCEAI_API_KEY && process.env.OPENAI_BASE_URL ? process.env.VYCEAI_API_KEY : undefined);
  if (openaiKey) {
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const content: Array<Record<string, unknown>> = [
      { type: "text", text: `Commuter Description:\n"${input.text}"` },
    ];
    if (input.image) {
      const mime = detectMimeType(input.image);
      content.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${input.image.toString("base64")}` },
      });
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: MULTIMODAL_PROMPT },
            { role: "user", content },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const rawText = json.choices?.[0]?.message?.content;
        if (rawText) {
          const parsed = parseMultimodalResponse(rawText, input.text, input.image, "openai");
          if (parsed) return parsed;
        }
      } else {
        console.warn(`[citizen-ai] OpenAI API returned status ${res.status}: ${await res.text().catch(() => "")}`);
      }
    } catch (e) {
      console.warn("[citizen-ai] OpenAI API request failed:", e instanceof Error ? e.message : e);
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

// ── local fallback engine (BERT + YOLO + Lexicon) ───────────────────────────

async function analyzeLocalReport(input: { text: string; image?: Buffer | null }): Promise<CitizenAIResult> {
  const text = analyzeText(input.text);
  const image = input.image ? analyzeImage(input.image) : Promise.resolve(null);
  const [t, img] = await Promise.all([text, image]);

  // lexicon safety floors on the text score
  let textScore = t.textScore;
  if (FLOOR_CRITICAL.test(input.text)) textScore = Math.max(textScore, 0.85);
  else if (FLOOR_HIGH.test(input.text)) textScore = Math.max(textScore, 0.6);

  // fusion: photo evidence can escalate, never downgrade, the description
  const fusedImageScore = img ? img.imageScore * 0.8 : null; // photo caps just under critical
  let finalScore = fusedImageScore != null ? Math.max(textScore, fusedImageScore) : textScore;

  // Local cross-modal consistency check
  let mismatch: CitizenAIResult["mismatch"] = null;
  if (img && (t.eventType === "accident" || t.eventType === "flood" || t.eventType === "transit_disruption" || t.eventType === "hazard")) {
    if (img.vehicleCount === 0 && img.heavyCount === 0 && img.personCount <= 3) {
      mismatch = {
        detected: true,
        reason: `Description reports a ${t.eventType.replace("_", " ")}, but the photo contains no vehicles or road hazard evidence.`,
      };
      finalScore = Math.min(finalScore, 0.35);
    }
  }

  return {
    engines: { bert: t.bert != null, yolo: img != null, lexicon: true, api: false, provider: "fallback" },
    text: { ...t, textScore },
    image: img && fusedImageScore != null ? { ...img, imageScore: fusedImageScore } : null,
    severity: scoreToSeverity(finalScore),
    finalScore,
    mismatch,
  };
}

// ── entry point ───────────────────────────────────────────────────────────────

export async function analyzeCitizenReport(input: { text: string; image?: Buffer | null }): Promise<CitizenAIResult> {
  // 1. Try high-precision multimodal API first if configured
  const apiResult = await callMultimodalApi(input).catch((e) => {
    console.warn("[citizen-ai] Multimodal API error, falling back to local models:", e);
    return null;
  });

  if (apiResult) {
    return apiResult;
  }

  // 2. On-server local BERT + YOLO backup
  return analyzeLocalReport(input);
}

/** small status probe for tests / debugging */
export async function citizenAIStatus(): Promise<{ bert: boolean; yolo: boolean }> {
  const [bert, yolo] = await Promise.all([
    loadBert()
      .then(() => true)
      .catch(() => false),
    loadYolo()
      .then(() => true)
      .catch(() => false),
  ]);
  return { bert, yolo };
}

export { EVENT_TYPES, SEVERITIES };
