// ─────────────────────────────────────────────────────────────────────────────
// Truth & verification engine.
//
// Layer 1 — source credibility: platform type + account signals (age,
//           followers, verified badge).
// Layer 2 — content plausibility: was a place resolved? time references?
//           shouting/ALL-CAPS? location implausibly far outside Chennai?
// Layer 3 — corroboration: independent authors reporting the same event type
//           within 1.5 km and a time window (the window adapts to replay
//           speed via timeScale so compressed replays keep their meaning).
// Layer 4 — official match: an official/news source in the same cluster.
//
// Composite score → verification status: verified (≥ .70), unverified
// (≥ .35), flagged (< .35 — likely rumor/exaggeration).

import { db } from "@/lib/db";
import { distanceKm } from "@/lib/social/gazetteer";

export type VerificationStatus = "verified" | "unverified" | "flagged";

const SOURCE_BASE: Record<string, number> = {
  official: 0.95,
  news: 0.85,
  telegram: 0.65,
  reddit: 0.6,
  twitter: 0.55,
  bluesky: 0.5,
  instagram: 0.5,
  facebook: 0.5,
  other: 0.5,
};

export type AuthorMeta = {
  accountAgeDays?: number;
  followers?: number;
  verified?: boolean;
};

export type TrustInput = {
  source: string;
  authorMeta?: AuthorMeta | null;
  text: string;
  resolvedLocation: boolean;
  outOfRegion: boolean;
  hasTimeRef: boolean;
  /** stored neighbours of the same event type (already fetched). */
  neighbors: Array<{ authorHandle: string | null; source: string }>;
};

export type TrustBreakdown = {
  sourceScore: number;
  contentScore: number;
  corroborationScore: number;
  officialMatch: boolean;
  distinctAuthors: number;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function sourceCredibility(source: string, meta?: AuthorMeta | null): number {
  let s = SOURCE_BASE[source] ?? 0.5;
  if (meta) {
    if (meta.verified) s += 0.08;
    if ((meta.accountAgeDays ?? 0) > 730) s += 0.05;
    if ((meta.accountAgeDays ?? 999) < 90) s -= 0.15;
    if ((meta.followers ?? 0) > 5000) s += 0.05;
    if ((meta.followers ?? 9999) < 50) s -= 0.1;
  }
  return clamp01(s);
}

function contentPlausibility(text: string, resolvedLocation: boolean, outOfRegion: boolean, hasTimeRef: boolean): number {
  let s = 0.25;
  if (resolvedLocation) s += 0.35;
  if (hasTimeRef) s += 0.15;
  if (text.length >= 40 && text.length <= 300) s += 0.15;
  const letters = text.replace(/[^A-Za-z]/g, "");
  const caps = text.replace(/[^A-Z]/g, "");
  if (letters.length > 20 && caps.length / letters.length > 0.45) s -= 0.25;
  if ((text.match(/!/g) ?? []).length > 3) s -= 0.15;
  if (outOfRegion) s -= 0.3;
  return clamp01(s);
}

function corroboration(neighbors: Array<{ authorHandle: string | null; source: string }>): { score: number; distinctAuthors: number; officialMatch: boolean } {
  const authors = new Set(neighbors.map((n) => n.authorHandle ?? "anon"));
  const distinctAuthors = authors.size;
  // One lone report is weak evidence; each extra independent author counts.
  const score = distinctAuthors <= 1 ? 0.15 : clamp01(0.15 + 0.28 * (distinctAuthors - 1));
  const officialMatch = neighbors.some((n) => n.source === "official" || n.source === "news");
  return { score, distinctAuthors, officialMatch };
}

export function computeTrust(input: TrustInput): { score: number; verification: VerificationStatus; breakdown: TrustBreakdown } {
  const sourceScore = sourceCredibility(input.source, input.authorMeta);
  const contentScore = contentPlausibility(input.text, input.resolvedLocation, input.outOfRegion, input.hasTimeRef);
  const { score: corrobScore, distinctAuthors, officialMatch } = corroboration(input.neighbors);

  let score = clamp01(
    0.3 * sourceScore +
      0.2 * contentScore +
      0.35 * corrobScore +
      0.15 * (officialMatch ? 1 : 0.1),
  );

  // Institutional floor: an official government/agency account (or a news
  // desk) reporting a located event is a trusted publisher by nature — it
  // must never sit below the "unverified" band just because it lacks
  // social-media corroboration.
  if (input.source === "official" && input.resolvedLocation && !input.outOfRegion) {
    score = Math.max(score, 0.78);
  } else if (input.source === "news" && input.resolvedLocation && !input.outOfRegion) {
    score = Math.max(score, 0.72);
  }

  // Credibility ceiling: a low-credibility source (brand-new account, tiny
  // following, unverified) can never reach "verified" on its own say-so —
  // even when it piggybacks on a real event's corroboration cluster (the
  // classic "parasitic rumor" pattern: exaggerating a real event). Its claim
  // stays amber until a trusted source says the same thing.
  if (sourceScore < 0.35) {
    score = Math.min(score, 0.65);
  }

  const verification: VerificationStatus = score >= 0.7 ? "verified" : score >= 0.35 ? "unverified" : "flagged";
  return { score, verification, breakdown: { sourceScore, contentScore, corroborationScore: corrobScore, officialMatch, distinctAuthors } };
}

// ── cluster maintenance ──────────────────────────────────────────────────────

export type SocialPostRow = {
  id: string;
  source: string;
  authorHandle: string | null;
  authorMeta: string | null;
  text: string;
  postedAt: Date;
  eventType: string | null;
  severity: string | null;
  sentiment: string | null;
  isMobility: boolean;
  lat: number | null;
  lon: number | null;
  placeLabel: string | null;
  trustScore: number | null;
  verification: string | null;
  corroborates: number;
  nlpMeta: string | null;
  timeScale: number;
};

/** Corroboration window in wall-clock minutes. A live feed (timeScale 1)
 *  clusters posts 60 min apart; a 30× replay compresses that to 2 min so the
 *  scenario's social dynamics survive the speed-up. */
export function windowMinutes(timeScale: number): number {
  return Math.max(2, Math.min(90, 60 / Math.max(1, timeScale)));
}

const GEO_RADIUS_KM = 1.5;

/** Find stored posts that could corroborate the given event (same type,
 *  nearby place, recent in scenario time, from any author). */
export async function findCluster(post: {
  eventType: string | null;
  lat: number | null;
  lon: number | null;
  postedAt: Date;
  timeScale: number;
  excludeId?: string;
}): Promise<SocialPostRow[]> {
  if (!post.eventType || post.lat == null || post.lon == null) return [];
  const win = windowMinutes(post.timeScale);
  const since = new Date(post.postedAt.getTime() - win * 60_000);
  const until = new Date(post.postedAt.getTime() + win * 60_000);
  const rows = (await db.socialPost.findMany({
    where: {
      eventType: post.eventType,
      isMobility: true,
      postedAt: { gte: since, lte: until },
      lat: { not: null },
      lon: { not: null },
    },
    take: 400,
  })) as unknown as SocialPostRow[];
  return rows.filter(
    (r) =>
      r.id !== post.excludeId &&
      r.lat != null &&
      r.lon != null &&
      distanceKm({ lat: post.lat!, lon: post.lon! }, { lat: r.lat, lon: r.lon }) <= GEO_RADIUS_KM,
  );
}

/** Recompute trust + corroboration counts for one post and everything in its
 *  cluster (inserting a new report strengthens the evidence for its
 *  neighbours too). */
export async function refreshClusterTrust(post: SocialPostRow): Promise<void> {
  const cluster = await findCluster({
    eventType: post.eventType,
    lat: post.lat,
    lon: post.lon,
    postedAt: post.postedAt,
    timeScale: post.timeScale,
  });
  const members = [post, ...cluster.filter((c) => c.id !== post.id)];

  const updates: Array<{ id: string; trustScore: number; verification: VerificationStatus; corroborates: number }> = [];
  for (const member of members) {
    const others = members.filter(
      (m) =>
        m.id !== member.id &&
        m.authorHandle !== member.authorHandle, // only independent authors corroborate
    );
    // neighbours for trust include same-author repeats (weak), but the
    // corroborates count tracks independent authors only.
    const neighborMeta = members.filter((m) => m.id !== member.id).map((m) => ({ authorHandle: m.authorHandle, source: m.source }));
    const meta = member.authorMeta ? (JSON.parse(member.authorMeta) as AuthorMeta) : null;
    const parsed = member.nlpMeta ? (JSON.parse(member.nlpMeta) as Record<string, unknown>) : {};
    const { score, verification, breakdown } = computeTrust({
      source: member.source,
      authorMeta: meta,
      text: member.text,
      resolvedLocation: member.lat != null && member.lon != null,
      outOfRegion: Boolean(parsed.outOfRegion),
      hasTimeRef: Boolean(parsed.hasTimeRef),
      neighbors: neighborMeta,
    });
    const distinctAuthors = new Set(others.map((m) => m.authorHandle ?? "anon")).size;
    updates.push({ id: member.id, trustScore: score, verification, corroborates: distinctAuthors });
  }

  for (const u of updates) {
    await db.socialPost.update({
      where: { id: u.id },
      data: { trustScore: u.trustScore, verification: u.verification, corroborates: u.corroborates },
    }).catch(() => undefined);
  }
}
