"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Report an incident — the citizen side of the pipeline.
//
// "See something on your commute? Report it." A commuter picks what they see
// (waterlogging, jam, breakdown…), how bad it is, describes it and confirms
// the area. POST /api/citizen/report feeds it through the SAME pipeline as
// social posts — classify → geocode → trust → incident report — and nearby
// commuters (including the reporter) get the geo-targeted advisory, while the
// report pops up in the CUMTA admin console for resolution.

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-store";
import { useAlerts, DEMO_AREAS } from "@/components/app/AlertsCenter";
import { OverlayShell } from "@/components/app/OverlayShell";
import { ALERT_EVENT_META, ALERT_SEV_COLOR, SEVERITY_RADIUS_KM } from "@/lib/alerts";
import { getStoredUser } from "@/lib/reporting";

type Phase = "form" | "sending" | "done";

type ReportResult = {
  code: string;
  title: string;
  action: string;
  severity: string;
  placeLabel: string | null;
  verification: string | null;
  trustScore: number | null;
};

/** the pickable incident types — same taxonomy as the NLP classifier */
const TYPES: Array<{ id: string; label: string; emoji: string; suggestion: string }> = [
  { id: "flood", label: "Waterlogging", emoji: "🌧", suggestion: "Knee-deep water on the road, autos refusing to ply." },
  { id: "congestion", label: "Heavy traffic", emoji: "🚗", suggestion: "Bumper-to-bumper traffic, barely moving for the last 15 minutes." },
  { id: "accident", label: "Accident", emoji: "💥", suggestion: "Two-wheeler skid near the signal, one lane blocked." },
  { id: "transit_disruption", label: "Metro / bus issue", emoji: "🚇", suggestion: "Trains held at the station, announcement says a signal fault." },
  { id: "road_closure", label: "Road closed", emoji: "🚧", suggestion: "Stretch barricaded by police, traffic being diverted." },
  { id: "infrastructure", label: "Damage / fault", emoji: "🔧", suggestion: "Traffic signal not working, junction is chaotic." },
  { id: "protest", label: "Protest", emoji: "📣", suggestion: "Road roko, crowd blocking the carriageway." },
  { id: "hazard", label: "Hazard", emoji: "⚠️", suggestion: "Live wire hanging low over the road after the rain." },
];

const SEV_OPTS = [
  { id: "low", label: "Minor", desc: "short-lived, small impact" },
  { id: "medium", label: "Noticeable", desc: "delay or diversion" },
  { id: "high", label: "Serious", desc: "major disruption" },
  { id: "critical", label: "Critical", desc: "danger to life" },
];

const MIN_CHARS = 10;
const MAX_CHARS = 300;

export function ReportIncidentOverlay() {
  const { closeOverlay, openOverlay } = useApp();
  const { area, refresh } = useAlerts();
  const [phase, setPhase] = useState<Phase>("form");
  const [type, setType] = useState<string | null>(null);
  const [severity, setSeverity] = useState("medium");
  const [text, setText] = useState("");
  const [reportArea, setReportArea] = useState(area);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const typeMeta = useMemo(() => TYPES.find((t) => t.id === type) ?? null, [type]);
  const ready = type != null && text.trim().length >= MIN_CHARS;

  const submit = async () => {
    if (!type || !ready) return;
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/citizen/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType: type,
          severity,
          text: text.trim(),
          lat: reportArea.lat,
          lon: reportArea.lon,
          areaLabel: reportArea.label,
          name: getStoredUser()?.name ?? null,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        post?: { placeLabel: string | null; severity: string | null; verification: string | null; trustScore: number | null };
        report?: { code: string; title: string; action: string } | null;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not send the report — try again.");
        setPhase("form");
        return;
      }
      setResult({
        code: data.report?.code ?? "—",
        title: data.report?.title ?? `${typeMeta?.label ?? "Incident"} reported`,
        action: data.report?.action ?? "created",
        severity: data.post?.severity ?? severity,
        placeLabel: data.post?.placeLabel ?? reportArea.label,
        verification: data.post?.verification ?? null,
        trustScore: data.post?.trustScore ?? null,
      });
      setPhase("done");
      void refresh(); // pull the fresh notification in immediately
    } catch {
      setError("Network error — try again.");
      setPhase("form");
    }
  };

  // ── form ────────────────────────────────────────────────────────────────
  if (phase === "form" || phase === "sending") {
    return (
      <OverlayShell title="Report an incident" onClose={closeOverlay} headerClass="bg-white text-slate-900" contentClass="pt-9">
        <div className="space-y-5 px-4 pb-8">
          <p className="text-[12px] leading-relaxed text-slate-500">
            Spotted waterlogging, a jam, a breakdown or a blocked road? Report it — it reaches the control
            room and <span className="font-semibold text-slate-700">alerts commuters near you</span>.
          </p>

          {/* what's happening */}
          <section>
            <h2 className="mb-2 text-[13px] font-bold text-slate-800">What&apos;s happening?</h2>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  aria-pressed={type === t.id}
                  className={cn(
                    "flex items-center gap-2 rounded-[18px] border px-3 py-2.5 text-left transition active:scale-[0.98]",
                    type === t.id
                      ? "border-[#5B4FE9] bg-[#5B4FE9]/8 shadow-sm ring-1 ring-[#5B4FE9]/30"
                      : "border-slate-200 bg-white",
                  )}
                >
                  <span className="text-[17px]" aria-hidden>
                    {t.emoji}
                  </span>
                  <span className={cn("text-[12px] font-bold", type === t.id ? "text-[#4438C9]" : "text-slate-700")}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* how bad */}
          <section>
            <h2 className="mb-2 text-[13px] font-bold text-slate-800">How bad is it?</h2>
            <div className="grid grid-cols-4 gap-1.5">
              {SEV_OPTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSeverity(s.id)}
                  aria-pressed={severity === s.id}
                  className={cn(
                    "rounded-[14px] border px-1 py-2 text-center transition active:scale-[0.98]",
                    severity === s.id ? "border-transparent text-white shadow-sm" : "border-slate-200 bg-white text-slate-600",
                  )}
                  style={severity === s.id ? { background: ALERT_SEV_COLOR[s.id] } : undefined}
                >
                  <span className="block text-[11px] font-extrabold">{s.label}</span>
                  <span className={cn("mt-0.5 block text-[8px] font-semibold leading-tight", severity === s.id ? "text-white/80" : "text-slate-400")}>
                    {s.desc}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] font-medium text-slate-400">
              Alerts commuters within <span className="font-bold text-slate-500">{SEVERITY_RADIUS_KM[severity]} km</span> of the spot.
            </p>
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
              rows={3}
              placeholder={typeMeta ? typeMeta.suggestion : "e.g. Waterlogging near the metro station, buses stuck…"}
              aria-label="Describe the incident"
              className="w-full resize-none rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 text-[12.5px] leading-relaxed text-slate-700 placeholder:text-slate-300 focus:border-[#5B4FE9] focus:outline-none focus:ring-2 focus:ring-[#5B4FE9]/20"
            />
            {typeMeta && (
              <button
                onClick={() => setText(typeMeta.suggestion)}
                className="mt-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[9.5px] font-bold text-slate-500 transition active:scale-95"
              >
                ✎ Use an example
              </button>
            )}
          </section>

          {/* where */}
          <section>
            <h2 className="mb-2 text-[13px] font-bold text-slate-800">Where are you?</h2>
            <div className="flex items-center gap-2 rounded-[18px] border border-slate-200 bg-white px-3.5 py-3">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0 text-[#5B4FE9]" fill="currentColor" aria-hidden>
                <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
              </svg>
              <label htmlFor="report-area" className="sr-only">
                Reporting from
              </label>
              <select
                id="report-area"
                value={reportArea.label}
                onChange={(e) => {
                  const a = DEMO_AREAS.find((d) => d.label === e.target.value);
                  if (a) setReportArea(a);
                }}
                className="flex-1 cursor-pointer appearance-none bg-transparent text-[13px] font-bold text-slate-800 focus:outline-none"
              >
                {!DEMO_AREAS.some((d) => d.label === reportArea.label) && <option value="">{reportArea.label}</option>}
                {DEMO_AREAS.map((a) => (
                  <option key={a.label} value={a.label}>
                    {a.label}
                  </option>
                ))}
              </select>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <p className="mt-1.5 text-[10px] font-medium text-slate-400">
              Your live GPS is attached — the incident is pinned where you are (prototype: the selected demo area).
            </p>
          </section>

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-600">
              {error}
            </p>
          )}

          {/* submit */}
          <button
            onClick={submit}
            disabled={!ready || phase === "sending"}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#5B4FE9] to-[#3D7BF0] py-3.5 text-[14px] font-extrabold text-white shadow-lg shadow-indigo-500/25 transition active:scale-[0.98] disabled:opacity-50"
          >
            {phase === "sending" ? (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                </svg>
                Sending to the control room…
              </>
            ) : (
              <>Send report</>
            )}
          </button>
          <p className="text-center text-[9.5px] leading-relaxed text-slate-400">
            Your report is checked by the same verification engine as social posts, then routed to the
            CUMTA console. Misuse can be traced to your account.
          </p>
        </div>
      </OverlayShell>
    );
  }

  // ── done ────────────────────────────────────────────────────────────────
  const sev = result?.severity ?? "medium";
  const ev = ALERT_EVENT_META[type ?? "other"] ?? ALERT_EVENT_META.other;
  const verification = result?.verification;
  const radius = SEVERITY_RADIUS_KM[sev] ?? 6;

  return (
    <OverlayShell title="Report an incident" onClose={closeOverlay} headerClass="bg-white text-slate-900">
      <div className="flex flex-col items-center px-5 pb-8 pt-8">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 shadow-inner" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <h2 className="mt-4 text-[19px] font-extrabold text-slate-900">Report sent!</h2>
        <p className="mt-1 text-center text-[12.5px] leading-relaxed text-slate-500">
          {result?.action === "updated" || result?.action === "escalated"
            ? "Your report was added to an ongoing incident at the same spot — it strengthens the evidence."
            : "The control room has been notified and is reviewing it."}
        </p>

        {/* report card */}
        <div className="mt-5 w-full overflow-hidden rounded-[22px] bg-white shadow-md">
          <div className="h-1.5 w-full" style={{ background: ALERT_SEV_COLOR[sev] }} />
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-900 px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest text-white">
                {result?.code}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                style={{ color: ALERT_SEV_COLOR[sev], background: `${ALERT_SEV_COLOR[sev]}1A` }}
              >
                {sev}
              </span>
              {verification && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider",
                    verification === "verified" ? "bg-emerald-50 text-emerald-700" : verification === "flagged" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700",
                  )}
                >
                  {verification}
                </span>
              )}
            </div>
            <p className="mt-2.5 text-[13.5px] font-bold leading-snug text-slate-800">
              {ev.emoji} {result?.title}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              {result?.placeLabel?.replace(/ \(.*\)$/, "") ?? reportArea.label} · just now
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-slate-500">
          Commuters within <span className="font-bold text-slate-700">{radius} km</span> of{" "}
          {result?.placeLabel?.replace(/ \(.*\)$/, "") ?? reportArea.label} are being alerted right now — you&apos;ll
          receive the same advisory on this phone.
        </p>

        <button
          onClick={() => openOverlay("notifications")}
          className="mt-5 w-full rounded-2xl bg-[#1A56DB] py-3.5 text-[13.5px] font-bold text-white shadow-lg shadow-blue-900/20 transition active:scale-[0.98]"
        >
          View my alerts
        </button>
        <div className="mt-2.5 flex w-full gap-2.5">
          <button
            onClick={() => {
              setPhase("form");
              setType(null);
              setText("");
              setResult(null);
              setSeverity("medium");
            }}
            className="flex-1 rounded-2xl bg-slate-100 py-3 text-[12.5px] font-bold text-slate-600 transition active:scale-[0.98]"
          >
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
