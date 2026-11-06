import { NextResponse } from "next/server";
import { SEVERITY_RADIUS_KM } from "@/lib/alerts";
import { reverseGeocode } from "@/lib/social/gazetteer";
import { analyzeCitizenReport, decodeDataImage, scoreToSeverity } from "@/lib/social/citizen-ai";
import { ingestPosts } from "@/lib/social/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/citizen/report — a commuter reports an incident from the Chennai
// One app ("See something? Report it"). The phone auto-attaches its GPS fix
// and the time of the report; the commuter types a description and may attach
// a photo. Server-side, two local transformer models analyse the report:
//
//   • BERT (DistilBERT-MNLI zero-shot) reads the description → event type +
//     severity distribution → text severity score
//   • YOLO (yolos-tiny) scans the photo → vehicles / heavy vehicles / people
//     counts → photo severity score
//   • finalScore = max(text, photo×0.88) → severity → alert radius
//
// The verdict then flows through the SAME pipeline as social posts (trust →
// incident report → geo-targeted notification → CUMTA console), with the AI's
// eventType/severity overriding the NLP guess via the citizen hint.
//
// Body: { text, lat, lon, occurredAt?, imageBase64?, thumbBase64?, name? }

// rough Chennai bounding box — reports from beyond it are rejected
const CHENNAI_BBOX = { minLat: 12.7, maxLat: 13.35, minLon: 79.85, maxLon: 80.45 };

export async function POST(req: Request) {
  let body: {
    text?: string;
    lat?: number;
    lon?: number;
    occurredAt?: string;
    imageBase64?: string;
    thumbBase64?: string;
    name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  // ── auto-detected location (the phone's GPS fix) ──────────────────────────
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < CHENNAI_BBOX.minLat ||
    lat > CHENNAI_BBOX.maxLat ||
    lon < CHENNAI_BBOX.minLon ||
    lon > CHENNAI_BBOX.maxLon
  ) {
    return NextResponse.json({ ok: false, error: "could not verify your location — allow GPS access and try again" }, { status: 400 });
  }
  const near = reverseGeocode(lat, lon, 5);
  const placeName = near?.name ?? "GPS location";

  // ── auto-detected time (client clock at the moment of reporting) ──────────
  let occurredAt = new Date();
  if (body.occurredAt) {
    const t = new Date(body.occurredAt);
    if (!Number.isNaN(t.getTime()) && Math.abs(Date.now() - t.getTime()) < 24 * 3600 * 1000) occurredAt = t;
  }

  // ── description ────────────────────────────────────────────────────────────
  const text = String(body.text ?? "").trim().slice(0, 500);
  if (text.length < 10) {
    return NextResponse.json({ ok: false, error: "please describe the issue (at least 10 characters)" }, { status: 400 });
  }

  // ── optional photo evidence (client-resized JPEG/PNG as base64) ───────────
  let photo: Buffer | null = null;
  if (typeof body.imageBase64 === "string" && body.imageBase64.length > 64) {
    photo = decodeDataImage(body.imageBase64);
    if (!photo) {
      return NextResponse.json({ ok: false, error: "unsupported photo format — use a JPEG or PNG image" }, { status: 400 });
    }
  }
  // tiny evidence thumbnail persisted with the AI meta (for the console)
  let thumb: string | null = null;
  if (typeof body.thumbBase64 === "string") {
    const t = body.thumbBase64.replace(/^data:image\/[a-z]+;base64,/i, "");
    if (t.length > 0 && t.length < 96 * 1024) thumb = `data:image/jpeg;base64,${t}`;
  }

  const name = String(body.name ?? "").trim().slice(0, 40) || null;

  // ── the AI pass: BERT reads the description, YOLO scans the photo ─────────
  const ai = await analyzeCitizenReport({ text, image: photo });
  const radiusKm = SEVERITY_RADIUS_KM[ai.severity] ?? 6;

  // ── persist through the standard pipeline ──────────────────────────────────
  const { results, outcomes, duplicates } = await ingestPosts(
    [
      {
        source: "citizen_app",
        handle: name ?? "chennai_one_commuter",
        text,
        geo: { lat, lon },
        postedAt: occurredAt.toISOString(),
        scenario: "citizen-report",
        citizen: { eventType: ai.text.eventType, severity: ai.severity, placeName },
        ai: {
          engines: ai.engines,
          eventType: ai.text.eventType,
          typeSource: ai.text.typeSource,
          severity: ai.severity,
          finalScore: Math.round(ai.finalScore * 100) / 100,
          textScore: Math.round(ai.text.textScore * 100) / 100,
          imageScore: ai.image ? Math.round(ai.image.imageScore * 100) / 100 : null,
          bert: ai.text.bert,
          yolo: ai.image ? { objects: ai.image.objects, vehicleCount: ai.image.vehicleCount, personCount: ai.image.personCount } : null,
          ...(thumb ? { photo: thumb } : {}),
        },
      },
    ],
    { awaitReports: true, timeScale: 1, noLlm: true },
  );

  const inserted = results.find((r) => !r.duplicate);
  if (!inserted) {
    // identical report already ingested — treat as accepted; the existing
    // report is what matters
    const dup = results[0];
    return NextResponse.json({
      ok: true,
      duplicate: true,
      post: dup ? { id: dup.dbId, eventType: dup.eventType, placeLabel: dup.placeLabel } : null,
      report: null,
      duplicates,
      ai: {
        eventType: ai.text.eventType,
        severity: ai.severity,
        finalScore: ai.finalScore,
        placeLabel: placeName,
        radiusKm,
      },
    });
  }

  const outcome = outcomes.find((o) => o.action !== "ignored") ?? null;

  return NextResponse.json(
    {
      ok: true,
      post: {
        id: inserted.dbId,
        eventType: inserted.eventType,
        severity: inserted.severity,
        placeLabel: inserted.placeLabel,
        lat: inserted.lat,
        lon: inserted.lon,
        trustScore: inserted.trustScore,
        verification: inserted.verification,
      },
      report:
        outcome && outcome.reportId
          ? { id: outcome.reportId, code: outcome.code, title: outcome.title, action: outcome.action }
          : null,
      ai: {
        engines: ai.engines,
        eventType: ai.text.eventType,
        typeSource: ai.text.typeSource,
        severity: ai.severity,
        textSeverity: scoreToSeverity(ai.text.textScore),
        finalScore: Math.round(ai.finalScore * 100) / 100,
        textScore: Math.round(ai.text.textScore * 100) / 100,
        imageScore: ai.image ? Math.round(ai.image.imageScore * 100) / 100 : null,
        bert: ai.text.bert,
        yolo: ai.image,
        placeLabel: placeName,
        detectedAt: occurredAt.toISOString(),
        radiusKm,
      },
    },
    { status: 201 },
  );
}
