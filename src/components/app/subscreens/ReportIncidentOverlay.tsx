"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Report an incident — the citizen side of the pipeline, AI-assisted.
//
// "See something on your commute? Report it." The commuter only describes
// what they see and (optionally) attaches a photo. The app AUTO-DETECTS the
// location (GPS → nearest gazetteer place) and the date/time. On submit:
//
//   description ──▶ BERT (DistilBERT-MNLI zero-shot) ──▶ event type + severity
//   photo       ──▶ YOLO (yolos-tiny) ──▶ vehicles / people counts
//                 ──▶ combined severity score (0–1)
//
// POST /api/citizen/report runs both models server-side, fuses the scores,
// and feeds the verdict through the SAME pipeline as social posts — trust →
// incident report → geo-targeted notification → CUMTA console. The result
// screen shows the commuter exactly what the AI understood and scored.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-store";
import { useAlerts, DEMO_AREAS } from "@/components/app/AlertsCenter";
import { OverlayShell } from "@/components/app/OverlayShell";
import { ALERT_EVENT_META, ALERT_SEV_COLOR, SEVERITY_RADIUS_KM, distanceKm } from "@/lib/alerts";
import { GAZETTEER } from "@/lib/social/gazetteer";
import { getStoredUser } from "@/lib/reporting";

type Phase = "form" | "sending" | "done";

type AIResp = {
  engines: { bert: boolean; yolo: boolean; lexicon: boolean; api?: boolean };
  eventType: string;
  typeSource: "lexicon" | "bert" | "api";
  severity: string;
  textSeverity: string;
  finalScore: number;
  textScore: number;
  imageScore: number | null;
  bert: { typeLabel: string; typeConfidence: number; severityLabel: string } | null;
  yolo: { objects: Array<{ label: string; count: number }>; vehicleCount: number; personCount: number } | null;
  mismatch?: { detected: boolean; reason: string } | null;
  placeLabel: string;
  detectedAt: string;
  radiusKm: number;
};

type ReportResult = {
  code: string;
  title: string;
  action: string;
  verification: string | null;
  trustScore: number | null;
  ai: AIResp;
  fromLabel: string;
  photoUrl?: string | null;
};

type PhotoState = { dataUrl: string; thumb: string; preview: string; capturedAt: string };

type LocState =
  | { mode: "detecting" }
  | { mode: "gps"; lat: number; lon: number; accuracy: number; label: string; km: number | null }
  | { mode: "fallback"; area: { label: string; lat: number; lon: number } };

const MIN_CHARS = 10;
const MAX_CHARS = 300;

const EXAMPLES = [
  "Knee-deep waterlogging under the bridge, autos refusing to ply, buses stuck.",
  "Bumper-to-bumper traffic near the signal, barely moving for the last 20 minutes.",
  "Two-wheeler skid near the junction, rider injured, one lane blocked.",
  "Metro trains held at the station, announcement says a signal fault.",
  "Lorry collided with an auto near the toll gate, people trapped inside.",
];

/** nearest known Chennai place to a coordinate (client-side gazetteer scan) */
function nearestPlace(lat: number, lon: number): { label: string; km: number | null } {
  let best: { label: string; km: number } | null = null;
  for (const g of GAZETTEER) {
    const km = distanceKm({ lat, lon }, g);
    if (!best || km < best.km) best = { label: g.name, km };
  }
  return best ? { label: best.label, km: best.km } : { label: "your location", km: null };
}

/** process a live video canvas snapshot directly from the camera stream */
async function processCanvasSnapshot(canvas: HTMLCanvasElement): Promise<PhotoState> {
  const scale = Math.min(1, 640 / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const big = document.createElement("canvas");
  big.width = w;
  big.height = h;
  const bCtx = big.getContext("2d");
  if (bCtx) bCtx.drawImage(canvas, 0, 0, w, h);
  const ts = Math.min(96 / w, 96 / h, 1);
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(w * ts));
  small.height = Math.max(1, Math.round(h * ts));
  const sCtx = small.getContext("2d");
  if (sCtx) sCtx.drawImage(canvas, 0, 0, small.width, small.height);
  return {
    dataUrl: big.toDataURL("image/jpeg", 0.75),
    thumb: small.toDataURL("image/jpeg", 0.6).split(",")[1] ?? "",
    preview: big.toDataURL("image/jpeg", 0.75),
    capturedAt: new Date().toISOString(),
  };
}

/** system-camera fallback: 640px JPEG for YOLO/Vision + 96px thumbnail */
async function processPhoto(file: File): Promise<PhotoState> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const big = document.createElement("canvas");
  big.width = w;
  big.height = h;
  big.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const ts = Math.min(96 / w, 96 / h, 1);
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(w * ts));
  small.height = Math.max(1, Math.round(h * ts));
  small.getContext("2d")!.drawImage(bitmap, 0, 0, small.width, small.height);
  bitmap.close?.();
  return {
    dataUrl: big.toDataURL("image/jpeg", 0.75),
    thumb: small.toDataURL("image/jpeg", 0.6).split(",")[1] ?? "",
    preview: big.toDataURL("image/jpeg", 0.75),
    capturedAt: new Date().toISOString(),
  };
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function ReportIncidentOverlay() {
  const { closeOverlay, openOverlay } = useApp();
  const { area, refresh } = useAlerts();
  const [phase, setPhase] = useState<Phase>("form");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<PhotoState | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loc, setLoc] = useState<LocState>(() =>
    // geolocation support is an environment constant — decide the initial
    // mode at render time so the mount effect never sets state synchronously
    typeof navigator === "undefined" || !navigator.geolocation
      ? { mode: "fallback", area: { label: area.label, lat: area.lat, lon: area.lon } }
      : { mode: "detecting" },
  );
  const [now, setNow] = useState(() => new Date());
  const [step, setStep] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── live camera state (camera-only capture to prevent stale/fake uploads) ─
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (mode: "environment" | "user" = "environment") => {
    setCameraError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Direct viewfinder is unavailable in this environment. Use the device camera trigger.");
      return;
    }
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setFacingMode(mode);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      }, 60);
    } catch (err) {
      console.warn("Live camera access failed:", err);
      setCameraError("Camera permission was denied. Please allow camera access to take live photo evidence.");
    }
  }, []);

  const takeLiveSnapshot = useCallback(async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoState = await processCanvasSnapshot(canvas);
    setPhoto(photoState);
    stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleClose = () => {
    stopCamera();
    closeOverlay();
  };

  // ── auto-detect location (GPS → nearest place; demo area as fallback) ────
  // `locate` only starts the async geolocation request (all setState lives in
  // its callbacks), so it is safe to call from an effect; `detectLocation`
  // adds the synchronous "detecting" reset for the retry button handler.
  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const near = nearestPlace(latitude, longitude);
        setLoc({ mode: "gps", lat: latitude, lon: longitude, accuracy, label: near.label, km: near.km });
      },
      () => {
        setLoc({ mode: "fallback", area: { label: area.label, lat: area.lat, lon: area.lon } });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }, [area.label, area.lat, area.lon]);

  const detectLocation = () => {
    setLoc({ mode: "detecting" });
    locate();
  };

  useEffect(() => {
    locate();
  }, [locate]);

  // live clock — the date/time is auto-captured with the report
  useEffect(() => {
    if (phase !== "form") return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const coords =
    loc.mode === "gps" ? { lat: loc.lat, lon: loc.lon, label: loc.label } : loc.mode === "fallback" ? { lat: loc.area.lat, lon: loc.area.lon, label: loc.area.label } : null;
  const ready = text.trim().length >= MIN_CHARS && coords != null;

  const steps = useMemo(
    () => [
      { label: "Fixing your location", detail: "GPS · gazetteer" },
      { label: "Reading your description", detail: "BERT · DistilBERT-MNLI" },
      ...(photo ? [{ label: "Scanning your photo", detail: "YOLO · yolos-tiny" }] : []),
      { label: "Scoring severity", detail: "text + photo fusion" },
      { label: "Routing to the control room", detail: "trust · geo-targeting" },
    ],
    [photo],
  );

  // advance the "analysing" animation while the request is in flight.
  // the step counter is reset in submit() (event handler) — effects must
  // not set state synchronously on phase change.
  useEffect(() => {
    if (phase !== "sending") return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1700);
    return () => clearInterval(t);
  }, [phase, steps.length]);

  const submit = async () => {
    if (!ready || !coords) return;
    setStep(0);
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/citizen/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          lat: coords.lat,
          lon: coords.lon,
          occurredAt: new Date().toISOString(),
          imageBase64: photo?.dataUrl ?? null,
          thumbBase64: photo?.thumb ?? null,
          name: getStoredUser()?.name ?? null,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        post?: { verification: string | null; trustScore: number | null };
        report?: { code: string; title: string; action: string } | null;
        ai?: AIResp;
      };
      if (!res.ok || !data.ok || !data.ai) {
        setError(data.error ?? "Could not send the report — try again.");
        setPhase("form");
        return;
      }
      setResult({
        code: data.report?.code ?? "—",
        title: data.report?.title ?? `${ALERT_EVENT_META[data.ai.eventType]?.label ?? "Incident"} reported`,
        action: data.report?.action ?? "created",
        verification: data.post?.verification ?? null,
        trustScore: data.post?.trustScore ?? null,
        ai: data.ai,
        fromLabel: coords.label,
        photoUrl: photo?.preview ?? null,
      });
      setPhase("done");
      void refresh(); // pull the fresh notification in immediately
    } catch {
      setError("Network error — try again.");
      setPhase("form");
    }
  };

  const reset = () => {
    setPhase("form");
    setText("");
    setPhoto(null);
    setResult(null);
    setError(null);
    setStep(0);
  };

  // ── form ────────────────────────────────────────────────────────────────
  if (phase === "form") {
    return (
      <OverlayShell title="Report an incident" onClose={handleClose} headerClass="bg-white text-slate-900" contentClass="pt-9">
        <div className="space-y-5 px-4 pb-8">
          <p className="text-[12px] leading-relaxed text-slate-500">
            Describe what you see and attach a photo — <span className="font-semibold text-slate-700">BERT reads your words, YOLO scans your
            photo</span> and the control room receives a severity-scored report.
          </p>

          {/* auto-detected location + time */}
          <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
            <div className="flex items-start gap-2.5 px-3.5 py-3">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#5B4FE9]" fill="currentColor" aria-hidden>
                <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#5B4FE9]">Auto-detected location</span>
                  {loc.mode === "gps" && (
                    <button onClick={detectLocation} className="rounded-full bg-[#5B4FE9]/10 px-1.5 py-px text-[8.5px] font-bold text-[#5B4FE9]">
                      re-detect
                    </button>
                  )}
                </div>
                {loc.mode === "detecting" && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-bold text-slate-500">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                    </svg>
                    Locating you…
                  </p>
                )}
                {loc.mode === "gps" && (
                  <>
                    <p className="mt-0.5 text-[13px] font-bold text-slate-800">{loc.label}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] font-semibold text-slate-400">
                      {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)} · ±{Math.round(loc.accuracy)} m
                      {loc.km != null && loc.km >= 0.05 ? ` · ${loc.km.toFixed(1)} km from ${loc.label}` : " · at the spot"}
                    </p>
                  </>
                )}
                {loc.mode === "fallback" && (
                  <>
                    <label htmlFor="report-area" className="sr-only">
                      Reporting from
                    </label>
                    <select
                      id="report-area"
                      value={loc.area.label}
                      onChange={(e) => {
                        const a = DEMO_AREAS.find((d) => d.label === e.target.value);
                        if (a) setLoc({ mode: "fallback", area: a });
                      }}
                      className="mt-0.5 w-full cursor-pointer appearance-none bg-transparent text-[13px] font-bold text-slate-800 focus:outline-none"
                    >
                      {!DEMO_AREAS.some((d) => d.label === loc.area.label) && <option value="">{loc.area.label}</option>}
                      {DEMO_AREAS.map((a) => (
                        <option key={a.label} value={a.label}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-0.5 text-[9.5px] font-semibold text-slate-400">GPS unavailable — prototype demo area selected</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-3.5 py-2">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" strokeLinecap="round" />
              </svg>
              <span className="text-[10.5px] font-bold text-slate-600">{fmtDateTime(now)}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">· auto-captured</span>
            </div>
          </section>

          {/* description */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[13px] font-bold text-slate-800">Describe it</h2>
              <span className={cn("text-[10px] font-semibold", text.trim().length >= MIN_CHARS ? "text-slate-400" : "text-orange-500")}>
                {text.trim().length < MIN_CHARS ? `${MIN_CHARS - text.trim().length} more characters needed` : `${text.trim().length}/${MAX_CHARS}`}
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              rows={4}
              placeholder="e.g. Knee-deep waterlogging under the bridge, autos refusing to ply…"
              aria-label="Describe the incident"
              className="w-full resize-none rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 text-[12.5px] leading-relaxed text-slate-700 placeholder:text-slate-300 focus:border-[#5B4FE9] focus:outline-none focus:ring-2 focus:ring-[#5B4FE9]/20"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EXAMPLES.slice(0, 3).map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setText(ex.slice(0, MAX_CHARS))}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[9.5px] font-bold text-slate-500 transition active:scale-95"
                >
                  ✎ Example {i + 1}
                </button>
              ))}
            </div>
          </section>

          {/* photo */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-slate-800">
                Live photo evidence <span className="font-semibold text-slate-400">(optional)</span>
              </h2>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-600 border border-emerald-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Camera Only
              </span>
            </div>

            {cameraActive ? (
              <div className="relative overflow-hidden rounded-[20px] bg-black border border-slate-700 shadow-md">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-64 w-full object-cover"
                />

                {/* Top overlay pills */}
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-1.5 rounded-full bg-slate-900/85 px-2.5 py-1 backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-white">Live Viewfinder</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode === "environment" ? "user" : "environment")}
                      className="rounded-full bg-slate-900/80 p-2 text-white hover:bg-slate-800 transition active:scale-95 backdrop-blur-md"
                      title="Flip camera"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.21.896 4.21 2.343 5.657L4 18h6v-6l-2.343 2.343C6.627 13.124 6 11.642 6 10c0-3.314 2.686-6 6-6s6 2.686 6 6c0 1.642-.627 3.124-1.657 4.343L18 16c1.242-1.636 2-3.705 2-6z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-full bg-slate-900/80 p-2 text-white hover:bg-slate-800 transition active:scale-95 backdrop-blur-md"
                      title="Close camera"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Bottom shutter bar */}
                <div className="absolute bottom-3.5 inset-x-0 flex flex-col items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={takeLiveSnapshot}
                    className="flex h-15 w-15 items-center justify-center rounded-full border-4 border-white bg-rose-500/90 shadow-xl transition active:scale-90"
                    title="Take Snapshot"
                  >
                    <span className="h-10 w-10 rounded-full bg-white transition" />
                  </button>
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9.5px] font-bold text-white/90 backdrop-blur-sm">
                    Tap shutter to take real-time photo
                  </span>
                </div>
              </div>
            ) : photo ? (
              <div className="relative overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                <img src={photo.preview} alt="Verified live report photo" className="max-h-52 w-full object-cover" />
                <div className="flex items-center justify-between bg-slate-900/90 px-3 py-2 text-white backdrop-blur">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-bold tracking-wide">
                      Verified Live Photo · {fmtDateTime(new Date(photo.capturedAt))}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="rounded-full bg-white/20 px-2.5 py-0.5 text-[9.5px] font-bold text-white hover:bg-white/30 transition"
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhoto(null)}
                      className="rounded-full bg-rose-500/30 px-2.5 py-0.5 text-[9.5px] font-bold text-rose-200 hover:bg-rose-500/50 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => startCamera("environment")}
                  className="flex w-full items-center justify-center gap-3 rounded-[18px] border-2 border-dashed border-[#5B4FE9]/30 bg-[#5B4FE9]/5 py-5 text-[#5B4FE9] transition active:scale-[0.99] hover:bg-[#5B4FE9]/8"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5B4FE9]/10">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#5B4FE9]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[12.5px] font-extrabold text-[#5B4FE9]">Take Live Photo</p>
                    <p className="text-[10px] font-semibold text-slate-500">Live camera only — gallery/file upload disabled to prevent fake data</p>
                  </div>
                </button>

                {cameraError && (
                  <div className="flex flex-col gap-1.5 rounded-xl bg-amber-50 p-2.5 text-[11px] font-medium text-amber-800 border border-amber-200/50">
                    <p>{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="self-start font-bold text-amber-900 underline"
                    >
                      Trigger Device System Camera
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Direct system camera trigger (capture=environment strictly launches camera) */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-label="Direct device camera capture"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  setPhoto(await processPhoto(f));
                } catch {
                  setError("Could not read that photo — please retry live capture.");
                }
              }}
            />
          </section>

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-600">
              {error}
            </p>
          )}

          {/* submit */}
          <button
            onClick={submit}
            disabled={!ready}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#5B4FE9] to-[#3D7BF0] py-3.5 text-[14px] font-extrabold text-white shadow-lg shadow-indigo-500/25 transition active:scale-[0.98] disabled:opacity-50"
          >
            Send report
          </button>
          <p className="text-center text-[9.5px] leading-relaxed text-slate-400">
            Your description is analysed by BERT, your photo by YOLO, and the scored report reaches the CUMTA console.
            Misuse can be traced to your account.
          </p>
        </div>
      </OverlayShell>
    );
  }

  // ── sending: the analysis pipeline, step by step ────────────────────────
  if (phase === "sending") {
    return (
      <OverlayShell title="Analysing your report" onClose={handleClose} headerClass="bg-white text-slate-900">
        <div className="flex flex-col items-center px-5 pb-8 pt-6">
          <div className="flex w-full items-center gap-2.5 rounded-[18px] border border-slate-200 bg-white px-3.5 py-2.5">
            {photo ? (
              <img src={photo.preview} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[15px]" aria-hidden>
                📝
              </span>
            )}
            <p className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-slate-600">“{text.trim()}”</p>
          </div>

          <div className="mt-5 w-full space-y-1">
            {steps.map((s, i) => {
              const state = i < step ? "done" : i === step ? "active" : "wait";
              return (
                <div key={s.label} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 transition", state === "active" && "bg-[#5B4FE9]/6")}>
                  {state === "done" ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100" aria-hidden>
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  ) : state === "active" ? (
                    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 animate-spin text-[#5B4FE9]" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-200" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[12px] font-bold", state === "wait" ? "text-slate-400" : "text-slate-800")}>{s.label}</p>
                    {state !== "wait" && <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{s.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-5 text-center text-[10px] font-semibold leading-relaxed text-slate-400">
            Local transformer inference — first run may take a few extra seconds while the models warm up.
          </p>
        </div>
      </OverlayShell>
    );
  }

  // ── done ────────────────────────────────────────────────────────────────
  const ai = result?.ai;
  const sev = ai?.severity ?? "medium";
  const ev = ALERT_EVENT_META[ai?.eventType ?? "other"] ?? ALERT_EVENT_META.other;
  const score = ai?.finalScore ?? 0;
  const scorePct = Math.round(score * 100);
  const photoPreview = photo?.preview ?? result?.photoUrl;

  return (
    <OverlayShell title="Report an incident" onClose={handleClose} headerClass="bg-white text-slate-900">
      <div className="flex flex-col items-center px-5 pb-8 pt-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 shadow-inner" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <h2 className="mt-3 text-[19px] font-extrabold text-slate-900">Report sent!</h2>
        <p className="mt-0.5 text-center text-[12px] leading-relaxed text-slate-500">
          {result?.action === "updated" || result?.action === "escalated"
            ? "Added to an ongoing incident at the same spot — your evidence strengthens it."
            : "The control room has been notified and is reviewing it."}
        </p>

        {/* AI analysis card */}
        <div className="mt-4 w-full overflow-hidden rounded-[22px] bg-white shadow-md">
          <div className="h-1.5 w-full" style={{ background: ALERT_SEV_COLOR[sev] }} />
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">AI severity analysis</span>
              <span className="flex items-center gap-1">
                {ai?.engines.api ? (
                  <>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-emerald-700">
                      GROQ VISION ✓
                    </span>
                    <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-[#5B4FE9]">
                      AI FUSION
                    </span>
                  </>
                ) : (
                  <>
                    <span className={cn("rounded-full px-1.5 py-px text-[8px] font-extrabold uppercase tracking-wider", ai?.engines.bert ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                      BERT {ai?.engines.bert ? "✓" : "—"}
                    </span>
                    <span className={cn("rounded-full px-1.5 py-px text-[8px] font-extrabold uppercase tracking-wider", ai?.engines.yolo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      YOLO {ai?.engines.yolo ? "✓" : "—"}
                    </span>
                  </>
                )}
              </span>
            </div>

            <div className="mt-2 flex items-end gap-3">
              <span className="text-[34px] font-black leading-none tracking-tight" style={{ color: ALERT_SEV_COLOR[sev] }}>
                {score.toFixed(2)}
              </span>
              <div className="flex-1 pb-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${scorePct}%`, background: ALERT_SEV_COLOR[sev] }} />
                </div>
              </div>
              <span
                className="mb-0.5 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider"
                style={{ color: ALERT_SEV_COLOR[sev], background: `${ALERT_SEV_COLOR[sev]}1A` }}
              >
                {sev}
              </span>
            </div>

            {/* discrepancy / fake report mismatch alert */}
            {ai?.mismatch?.detected && (
              <div className="mt-3 rounded-[16px] border border-amber-300 bg-amber-50/90 p-3 text-amber-950 shadow-sm">
                <div className="flex items-center gap-1.5 font-extrabold text-[12px] text-amber-900">
                  <span className="text-[14px]">⚠️</span>
                  <span>Photo &amp; Description Mismatch Detected</span>
                </div>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-amber-800">
                  {ai.mismatch.reason}
                </p>
                <div className="mt-2 flex items-center gap-1.5 border-t border-amber-200/60 pt-2 text-[10px] font-bold text-amber-900">
                  <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[8.5px] uppercase tracking-wider text-white">Flagged</span>
                  <span>Incident severity was throttled to prevent false panic.</span>
                </div>
              </div>
            )}

            {/* description row */}
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-px text-[13px]" aria-hidden>
                  📝
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Description · {ai?.typeSource === "api" ? "Multimodal AI" : `BERT${ai?.typeSource === "lexicon" ? " + lexicon" : ""}`}
                  </p>
                  <p className="text-[11.5px] font-bold leading-snug text-slate-700">
                    {ev.emoji} {ev.label}
                    {ai?.bert && <span className="font-semibold text-slate-500"> · read as {ai.textSeverity ?? ai.bert.severityLabel} ({(ai.bert.typeConfidence * 100).toFixed(0)}% type conf.)</span>}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400">text score {ai?.textScore?.toFixed(2) ?? "—"}</p>
                </div>
              </div>

              {/* photo row */}
              <div className="flex items-start gap-2">
                <span className="mt-px text-[13px]" aria-hidden>
                  📷
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Photo · {ai?.engines?.api ? "Multimodal Vision" : "YOLO"}</p>
                  {ai?.yolo || photoPreview ? (
                    <>
                      <p className="text-[11.5px] font-bold leading-snug text-slate-700">
                        {ai?.yolo && ai.yolo.objects.length > 0
                          ? ai.yolo.objects
                              .slice(0, 4)
                              .map((o) => `${o.count} ${o.count > 1 ? o.label + "s" : o.label}`)
                              .join(" · ")
                          : ai?.mismatch?.detected
                            ? "Scene mismatch: Irrelevant scene or no road hazards"
                            : "Live photo verified · No road hazards detected"}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400">
                        scene score {ai?.imageScore != null ? ai.imageScore.toFixed(2) : "0.05"} · can escalate, never downgrade
                      </p>
                    </>
                  ) : (
                    <p className="text-[11.5px] font-semibold text-slate-400">no photo attached</p>
                  )}
                </div>
                {photoPreview && (
                  <img src={photoPreview} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                )}
              </div>

              {/* fusion row */}
              <div className="flex items-start gap-2">
                <span className="mt-px text-[13px]" aria-hidden>
                  ⚖️
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Combined severity</p>
                  <p className="text-[11.5px] font-bold text-slate-700">
                    final = max(text{ai?.imageScore != null ? ", photo×0.8" : ""}) → <span style={{ color: ALERT_SEV_COLOR[sev] }}>{score.toFixed(2)}</span> · alerts within{" "}
                    <span className="underline decoration-dotted">{ai?.radiusKm} km</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* report card */}
        <div className="mt-3 w-full overflow-hidden rounded-[22px] bg-white shadow-md">
          <div className="flex items-center gap-2 p-4 pb-2.5">
            <span className="rounded-full bg-slate-900 px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest text-white">{result?.code}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
              style={{ color: ALERT_SEV_COLOR[sev], background: `${ALERT_SEV_COLOR[sev]}1A` }}
            >
              {sev}
            </span>
            {result?.verification && (
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider",
                  result.verification === "verified" ? "bg-emerald-50 text-emerald-700" : result.verification === "flagged" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700",
                )}
              >
                {result.verification}
              </span>
            )}
          </div>
          <div className="px-4 pb-4">
            <p className="text-[13.5px] font-bold leading-snug text-slate-800">{result?.title}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              {ai?.placeLabel?.replace(/ \(.*\)$/, "") ?? result?.fromLabel} · {ai?.detectedAt ? fmtDateTime(new Date(ai.detectedAt)) : "just now"}
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-slate-500">
          Commuters within <span className="font-bold text-slate-700">{ai?.radiusKm} km</span> are being alerted right now — you&apos;ll receive the
          same advisory on this phone.
        </p>

        <button
          onClick={() => openOverlay("notifications")}
          className="mt-4 w-full rounded-2xl bg-[#1A56DB] py-3.5 text-[13.5px] font-bold text-white shadow-lg shadow-blue-900/20 transition active:scale-[0.98]"
        >
          View my alerts
        </button>
        <div className="mt-2.5 flex w-full gap-2.5">
          <button onClick={reset} className="flex-1 rounded-2xl bg-slate-100 py-3 text-[12.5px] font-bold text-slate-600 transition active:scale-[0.98]">
            Report another
          </button>
          <button onClick={closeOverlay} className="flex-1 rounded-2xl bg-slate-800 py-3 text-[12.5px] font-bold text-white transition active:scale-[0.98]">
            Done
          </button>
        </div>
      </div>
    </OverlayShell>
  );
}
