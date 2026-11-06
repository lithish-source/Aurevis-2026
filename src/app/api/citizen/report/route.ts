import { NextResponse } from "next/server";
import { EVENT_TYPES, SEVERITIES } from "@/lib/social/classify";
import { ingestPosts } from "@/lib/social/ingest";

export const dynamic = "force-dynamic";

// POST /api/citizen/report — a commuter reports an incident from the Chennai
// One app ("See something? Report it"). The report runs through the SAME
// pipeline as social posts (classify → geocode → trust → incident report →
// geo-targeted notification), with the reporter's own picks overriding the
// NLP guess — they picked the type on screen and the app attached their GPS.
//
// Body: { eventType, severity, text, lat, lon, areaLabel, name? }
// Returns the created/updated incident report so the phone can confirm with
// the RPT code, plus the trust verdict the report earned.

// rough Chennai bounding box — reports from beyond it are rejected
const CHENNAI_BBOX = { minLat: 12.70, maxLat: 13.35, minLon: 79.85, maxLon: 80.45 };

export async function POST(req: Request) {
  let body: {
    eventType?: string;
    severity?: string;
    text?: string;
    lat?: number;
    lon?: number;
    areaLabel?: string;
    name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const eventType = String(body.eventType ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (!(EVENT_TYPES as readonly string[]).includes(eventType)) {
    return NextResponse.json({ ok: false, error: "unknown incident type" }, { status: 400 });
  }
  const severity = String(body.severity ?? "medium").toLowerCase();
  if (!(SEVERITIES as readonly string[]).includes(severity)) {
    return NextResponse.json({ ok: false, error: "unknown severity" }, { status: 400 });
  }

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
    return NextResponse.json({ ok: false, error: "location is outside Chennai" }, { status: 400 });
  }

  const text = String(body.text ?? "").trim().slice(0, 500);
  if (text.length < 10) {
    return NextResponse.json({ ok: false, error: "please describe the issue (at least 10 characters)" }, { status: 400 });
  }

  const areaLabel = String(body.areaLabel ?? "").trim().slice(0, 80) || undefined;
  const name = String(body.name ?? "").trim().slice(0, 40) || null;

  const { results, outcomes, duplicates } = await ingestPosts(
    [
      {
        source: "citizen_app",
        handle: name ?? "chennai_one_commuter",
        text,
        geo: { lat, lon },
        postedAt: new Date().toISOString(),
        scenario: "citizen-report",
        citizen: { eventType, severity, placeName: areaLabel },
      },
    ],
    { awaitReports: true, timeScale: 1 },
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
    },
    { status: 201 },
  );
}
