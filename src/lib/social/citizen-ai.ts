// ─────────────────────────────────────────────────────────────────────────────
// Citizen-report AI: local BERT + YOLO inference for "See something? Report it".
//
// When a commuter files a report from the app, the description and the photo
// are analysed ON-SERVER by two real transformer models (via transformers.js,
// ONNX Runtime CPU — no API keys, no GPU, ₹0):
//
//   • BERT  — Xenova/distilbert-base-uncased-mnli (DistilBERT, an NLI-tuned
//             distilled BERT) run as a zero-shot classifier over the report
//             text: one pass reads WHAT is happening (event type), one pass
//             reads HOW BAD it is (severity distribution → severity score).
//   • YOLO  — Xenova/yolos-tiny, real-time object detection over the attached
//             photo: counts cars / trucks / buses / two-wheelers / people and
//             turns scene density into a photo severity score.
//
// Ensemble & fusion:
//   • Event type: the domain lexicon (src/lib/social/classify.ts keyword
//     engine) wins when it fires — it is hand-tuned for Chennai transit
//     vocabulary; BERT is the semantic fallback for paraphrases it misses.
//   • Severity score: textScore = BERT severity distribution (normalised,
//     weighted low→critical) with lexicon safety floors (trapped/casualty…
//     ⇒ ≥0.85 critical; injured/knee-deep… ⇒ ≥0.60 high).
//   • finalScore = max(textScore, imageScore × 0.80) — photo evidence can
//     ESCALATE a report (a jam photo next to a mild description) but never
//     downgrades the words of someone standing at the scene. The cap keeps
//     "critical" reachable only through the description (someone at the
//     scene describing a life-threatening situation), never a photo alone.
//
// Everything degrades gracefully: BERT unavailable → lexicon-only scoring;
// YOLO unavailable / no photo → text-only scoring. The engines that produced
// each verdict travel with the response and are persisted in nlpMeta.ai.
import { heuristicClassify, EVENT_TYPES, SEVERITIES, type Severity, type EventType } from "@/lib/social/classify";

// ── public types ─────────────────────────────────────────────────────────────

export type CitizenAIEngines = { bert: boolean; yolo: boolean; lexicon: boolean };

export type CitizenAIText = {
  eventType: EventType;
  /** which engine decided the event type */
  typeSource: "lexicon" | "bert";
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

function yoloSceneScore(vehicleCount: number, personCount: number, heavyCount: number, vulnerableCount: number): number {
  let base = 0.05;
  if (vehicleCount >= 31) base = 0.78;
  else if (vehicleCount >= 16) base = 0.66;
  else if (vehicleCount >= 6) base = 0.5;
  else if (vehicleCount >= 1) base = 0.3;
  let score = base;
  if (heavyCount >= 2) score += 0.08;
  if (personCount >= 5) score += 0.08;
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

export function decodeDataImage(dataUrlOrBase64: string): Buffer | null {
  const b64 = dataUrlOrBase64.replace(/^data:image\/[a-z]+;base64,/i, "");
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
    const dets = await withTimeout(
      detector(image, { threshold: 0.4, percentage: true }) as Promise<Array<{ label: string; score: number }>>,
      60_000,
      "yolo inference",
    );

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

// ── entry point ───────────────────────────────────────────────────────────────

export async function analyzeCitizenReport(input: { text: string; image?: Buffer | null }): Promise<CitizenAIResult> {
  const text = analyzeText(input.text);
  const image = input.image ? analyzeImage(input.image) : Promise.resolve(null);
  const [t, img] = await Promise.all([text, image]);

  // lexicon safety floors on the text score
  let textScore = t.textScore;
  if (FLOOR_CRITICAL.test(input.text)) textScore = Math.max(textScore, 0.85);
  else if (FLOOR_HIGH.test(input.text)) textScore = Math.max(textScore, 0.6);

  // fusion: photo evidence can escalate, never downgrade, the description
  const fusedImageScore = img ? img.imageScore * 0.8 : null; // photo caps just under critical
  const finalScore = fusedImageScore != null ? Math.max(textScore, fusedImageScore) : textScore;

  return {
    engines: { bert: t.bert != null, yolo: img != null, lexicon: true },
    text: { ...t, textScore },
    image: img && fusedImageScore != null ? { ...img, imageScore: fusedImageScore } : null,
    severity: scoreToSeverity(finalScore),
    finalScore,
  };
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
