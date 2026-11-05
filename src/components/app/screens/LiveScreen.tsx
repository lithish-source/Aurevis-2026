"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-store";
import { LIVE_BUSES, BUS_ALERTS, BUS_ROUTE_578_GEO, METRO_ROUTE_INFO, SAMPLE_METRO_JOURNEY, type LiveBus } from "@/lib/transit-data";
import { RouteMapLeaflet } from "@/components/app/maps";
import { CityPulseScreen } from "@/components/app/screens/CityPulseScreen";
import { cn } from "@/lib/utils";

// ─── route geometry comes from transit-data (real-world coordinates) ───────────

// ─── status helpers ──────────────────────────────────────────────────────────

function statusStyle(status: LiveBus["status"]) {
  switch (status) {
    case "On Time":
      return "bg-emerald-50 text-[#1E9E5A]";
    case "Delayed":
      return "bg-rose-50 text-rose-600";
    case "Approaching":
      return "bg-amber-50 text-[#B07818]";
    default:
      return "bg-sky-50 text-sky-700";
  }
}

function occupancyDots(o: LiveBus["occupancy"]) {
  return o === "Low" ? 1 : o === "Moderate" ? 2 : 3;
}

// ─── bus row ─────────────────────────────────────────────────────────────────

function BusRow({ bus, index }: { bus: LiveBus; index: number }) {
  const { openOverlay } = useApp();
  return (
    <button
      onClick={() => openOverlay("busDetail")}
      className="flex w-full items-center gap-3 rounded-[22px] border border-slate-100 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.98]"
      style={{ animation: `fadeup 0.45s ${index * 0.07}s both` }}
    >
      {/* route badge */}
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#1B2D42] shadow-inner">
        <span className="text-[13px] font-extrabold leading-none text-[#FBE18C]">{bus.routeNo}</span>
        <span className="mt-0.5 text-[7.5px] font-bold uppercase tracking-wide text-slate-300">{bus.type}</span>
      </span>

      {/* middle */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-bold text-slate-900">{bus.destination}</span>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold", statusStyle(bus.status))}>
            {bus.status}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{bus.via}</span>
        <span className="mt-1 flex items-center gap-3 text-[9.5px] font-semibold text-slate-400">
          <span>₹{bus.fare} · {bus.stopsAway} stops</span>
          <span className="flex items-center gap-0.5">
            {[0, 1, 2].map((d) => (
              <span key={d} className={cn("h-1.5 w-1.5 rounded-full", d < occupancyDots(bus.occupancy) ? "bg-[#1A56DB]" : "bg-slate-200")} />
            ))}
            <span className="ml-1">{bus.occupancy}</span>
          </span>
        </span>
      </span>

      {/* eta */}
      <span className="shrink-0 text-right">
        <span className="block text-[20px] font-extrabold leading-none text-[#1A56DB]">
          {bus.etaMin}
          <span className="text-[10px] font-bold text-slate-400"> min</span>
        </span>
        <span className="mt-1 block text-[9.5px] font-medium text-slate-400">{bus.arrivalTime}</span>
      </span>
    </button>
  );
}

// ─── 7-segment countdown (metro) ─────────────────────────────────────────────

const SEG_MAP: Record<string, number[]> = {
  // segments: a b c d e f g  (a top, b top-right, c bottom-right, d bottom, e bottom-left, f top-left, g middle)
  "0": [1, 1, 1, 1, 1, 1, 0],
  "1": [0, 1, 1, 0, 0, 0, 0],
  "2": [1, 1, 0, 1, 1, 0, 1],
  "3": [1, 1, 1, 1, 0, 0, 1],
  "4": [0, 1, 1, 0, 0, 1, 1],
  "5": [1, 0, 1, 1, 0, 1, 1],
  "6": [1, 0, 1, 1, 1, 1, 1],
  "7": [1, 1, 1, 0, 0, 0, 0],
  "8": [1, 1, 1, 1, 1, 1, 1],
  "9": [1, 1, 1, 1, 0, 1, 1],
};

function Digit({ char }: { char: string }) {
  const segs = SEG_MAP[char] ?? SEG_MAP["0"];
  const on = "bg-[#7CFFB2] drop-shadow-[0_0_6px_rgba(124,255,178,0.8)]";
  const off = "bg-[#7CFFB2]/10";
  return (
    <span className="relative inline-block h-[46px] w-[26px]">
      <span className={cn("absolute left-[5px] right-[5px] top-0 h-[5px] rounded-full", segs[0] ? on : off)} />
      <span className={cn("absolute right-0 top-[3px] h-[19px] w-[5px] rounded-full", segs[1] ? on : off)} />
      <span className={cn("absolute bottom-[3px] right-0 h-[19px] w-[5px] rounded-full", segs[2] ? on : off)} />
      <span className={cn("absolute bottom-0 left-[5px] right-[5px] h-[5px] rounded-full", segs[3] ? on : off)} />
      <span className={cn("absolute bottom-[3px] left-0 h-[19px] w-[5px] rounded-full", segs[4] ? on : off)} />
      <span className={cn("absolute left-0 top-[3px] h-[19px] w-[5px] rounded-full", segs[5] ? on : off)} />
      <span className={cn("absolute left-[5px] right-[5px] top-[21px] h-[5px] rounded-full", segs[6] ? on : off)} />
    </span>
  );
}

function Countdown({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const str = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return (
    <span className="flex items-center gap-1" aria-label={`Next train in ${m} minutes ${s} seconds`}>
      {str.split("").map((ch, i) =>
        ch === ":" ? (
          <span key={i} className="mx-0.5 flex h-[46px] flex-col items-center justify-center gap-2">
            <span className="h-[5px] w-[5px] rounded-full bg-[#7CFFB2]" />
            <span className="h-[5px] w-[5px] rounded-full bg-[#7CFFB2]" />
          </span>
        ) : (
          <Digit key={i} char={ch} />
        )
      )}
    </span>
  );
}

// ─── metro route progress ────────────────────────────────────────────────────

function MetroRouteProgress({ stations, current }: { stations: string[]; current: number }) {
  return (
    <div className="rounded-[22px] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-bold text-slate-800">Blue Line · Towards Government Estate</p>
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9.5px] font-bold text-sky-700">10 stops</span>
      </div>
      <ol className="relative">
        {stations.map((name, i) => {
          const done = i < current;
          const here = i === current;
          return (
            <li key={name} className="relative flex gap-3 pb-4 last:pb-0">
              {/* connector */}
              {i < stations.length - 1 && (
                <span
                  className={cn(
                    "absolute left-[9px] top-[18px] h-[calc(100%-10px)] w-[3px] rounded-full",
                    done ? "bg-sky-500" : "bg-slate-200"
                  )}
                />
              )}
              {/* node */}
              <span className="relative z-10 mt-0.5 flex h-[21px] w-[21px] shrink-0 items-center justify-center">
                {here ? (
                  <>
                    <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/50" />
                    <span className="relative flex h-[21px] w-[21px] items-center justify-center rounded-full border-[3px] border-white bg-sky-600 shadow-md shadow-sky-600/40" >
                      <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="currentColor" aria-hidden>
                        <path d="M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3l1 3h-2l-1-3h-4l-1 3H7l1-3a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 3v4h8V6H8z" />
                      </svg>
                    </span>
                  </>
                ) : (
                  <span className={cn("h-[13px] w-[13px] rounded-full border-[3px]", done ? "border-sky-500 bg-sky-100" : "border-slate-300 bg-white")} />
                )}
              </span>
              {/* labels */}
              <span className="flex min-w-0 flex-1 items-start justify-between gap-2 pt-0.5">
                <span className={cn("truncate text-[12px] font-semibold", here ? "text-sky-700" : done ? "text-slate-700" : "text-slate-400")}>{name}</span>
                {here && <span className="shrink-0 rounded-md bg-sky-600 px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-wide text-white">TRAIN HERE</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── alert icon ──────────────────────────────────────────────────────────────

function AlertIcon({ name }: { name: string }) {
  if (name === "bus")
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1v2.2a1 1 0 0 1-2 0V18h-2.5v2.2a1 1 0 0 1-2 0V18H9v2.2a1 1 0 0 1-2 0V18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      </svg>
    );
  if (name === "clock")
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 2l8 3.5V11c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5.5L12 2z" />
    </svg>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export function LiveScreen() {
  const { openOverlay, liveMode, setLiveMode } = useApp();
  // mode lives in the app store so the home-screen City Pulse card can open
  // this overlay directly in pulse mode
  const mode = liveMode;

  // animated bus position along the route
  const [progress, setProgress] = useState(0.42);
  useEffect(() => {
    const t = setInterval(() => setProgress((p) => (p >= 1 ? 0.35 : p + 0.006)), 400);
    return () => clearInterval(t);
  }, []);

  // metro countdown (starts at 4:26 like the sample)
  const [secondsLeft, setSecondsLeft] = useState(4 * 60 + 26);
  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => (s <= 0 ? 5 * 60 + 12 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // train position through METRO_ROUTE_INFO (advances every 9s)
  const [trainAt, setTrainAt] = useState(2);
  useEffect(() => {
    const t = setInterval(() => setTrainAt((i) => (i >= METRO_ROUTE_INFO.length - 1 ? 0 : i + 1)), 9000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-full overflow-y-auto pb-28">
      {/* ── mode switch ── */}
      <div className="sticky top-0 z-20 bg-white/85 px-4 pb-2.5 pt-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[330px] rounded-full bg-slate-100 p-1 shadow-inner">
          {(["bus", "metro", "pulse"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setLiveMode(m);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[11.5px] font-bold transition-all",
                mode === m ? "bg-[#1B2D42] text-white shadow-md" : "text-slate-500"
              )}
            >
              {m === "bus" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill={mode === "bus" ? "#FBE18C" : "currentColor"} aria-hidden>
                  <path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1v2.2a1 1 0 0 1-2 0V18h-2.5v2.2a1 1 0 0 1-2 0V18H9v2.2a1 1 0 0 1-2 0V18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1 3v6h12V6H6z" />
                </svg>
              )}
              {m === "metro" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3l1 3h-2l-1-3h-4l-1 3H7l1-3a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 3v4h8V6H8z" />
                </svg>
              )}
              {m === "pulse" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M12 2a10 10 0 0 0-10 10 10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm0 2a8 8 0 0 1 8 8 8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8zm-1 4v5.4l4.2 2.5 1-1.7-3.2-1.9V8h-2z" />
                </svg>
              )}
              {m === "bus" ? "Bus" : m === "metro" ? "Metro" : "City Pulse"}
            </button>
          ))}
        </div>
      </div>

      {mode === "pulse" ? (
        /* ══════════════ CITY PULSE — social mobility event intelligence ══════════════ */
        <CityPulseScreen />
      ) : mode === "bus" ? (
        /* ══════════════ BUS MODE — real Leaflet route map ══════════════ */
        <>
          <div className="relative">
            <RouteMapLeaflet
              className="h-[280px] w-full"
              stops={BUS_ROUTE_578_GEO}
              progress={progress}
              vehicle="bus"
              eta={{ stopIndex: 4, text: "22 min" }}
              onDetails={() => openOverlay("busDetail")}
            />
            {/* floating map controls */}
            <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-2">
              <button aria-label="Recenter map" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg shadow-black/15 transition active:scale-95">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="12" r="3.2" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
              </button>
              <button aria-label="Map layers" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg shadow-black/15 transition active:scale-95">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M12 2l9 5-9 5-9-5 9-5zm0 8.8L3.7 6.4 2 7.4l10 5.6 10-5.6-1.7-1L12 10.8zm0 5L3.7 11.4 2 12.4l10 5.6 10-5.6-1.7-1L12 15.8z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-4 pt-4">
            {/* route summary */}
            <div className="mb-4 flex items-center gap-3 rounded-[22px] bg-[#1B2D42] p-4 text-white shadow-md">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FBE18C] text-[14px] font-extrabold text-[#1B2D42]">578</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">CMBT → Sriperumbudur</span>
                <span className="block text-[10.5px] text-slate-300">Via Chennai–Bengaluru Hwy · 42 km</span>
              </span>
              <span className="shrink-0 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                7 buses live
              </span>
            </div>

            {/* live badge header */}
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-[18px] font-bold text-slate-900">Arriving at your stop</h2>
                <p className="text-[11.5px] text-slate-500">Poonamallee Terminus · Platform 3</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
                </span>
                LIVE
              </span>
            </div>

            {/* bus list */}
            <div className="flex flex-col gap-3">
              {LIVE_BUSES.map((bus, i) => (
                <BusRow key={bus.routeNo} bus={bus} index={i} />
              ))}
            </div>

            {/* alerts */}
            <h3 className="mb-2.5 mt-6 text-[15px] font-bold text-slate-800">Service updates</h3>
            <div className="flex flex-col gap-2.5">
              {BUS_ALERTS.map((a) => (
                <div key={a.title} className="flex gap-3 rounded-[22px] bg-white p-3.5 shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <AlertIcon name={a.icon} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2">
                      <span className="text-[12.5px] font-bold text-slate-800">{a.title}</span>
                      <span className="text-[10px] text-slate-400">{a.time}</span>
                    </p>
                    <p className="text-[11.5px] leading-snug text-slate-500">{a.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ══════════════ METRO MODE ══════════════ */
        <div className="px-4 pt-3">
          {/* countdown card */}
          <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0F2027] via-[#203A43] to-[#1B2D42] p-5 shadow-lg">
            <span className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-sky-400/10" />
            <span className="pointer-events-none absolute -bottom-14 -left-6 h-32 w-32 rounded-full bg-sky-500/10" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300/80">Next train · Meenambakkam</p>
                  <p className="mt-0.5 text-[10.5px] text-slate-400">Blue Line · Platform 2 · Towards Government Estate</p>
                </div>
                <button
                  onClick={() => openOverlay("timetable")}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-sky-200 transition active:scale-95"
                >
                  Timetable
                </button>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <Countdown seconds={secondsLeft} />
                <span className="pb-1 text-right">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Departs</span>
                  <span className="block text-[13px] font-bold text-sky-200">
                    {(() => {
                      const d = new Date();
                      d.setSeconds(d.getSeconds() + secondsLeft);
                      return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
                    })()}
                  </span>
                </span>
              </div>
              {/* following trains */}
              <div className="mt-4 flex gap-2 border-t border-white/10 pt-3">
                {SAMPLE_METRO_JOURNEY.trains.slice(1).map((t) => (
                  <span key={t.code + t.time} className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-sky-200/80">
                    <svg viewBox="0 0 24 24" className="h-3 w-3 text-sky-400" fill="currentColor" aria-hidden>
                      <path d="M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3l1 3h-2l-1-3h-4l-1 3H7l1-3a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
                    </svg>
                    {t.time}
                  </span>
                ))}
                <span className="ml-auto self-center text-[9.5px] text-slate-500">then every ~4 min</span>
              </div>
            </div>
          </div>

          {/* stats grid */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { label: "Fare", value: `₹${SAMPLE_METRO_JOURNEY.fare}`, sub: "token" },
              { label: "Duration", value: `${SAMPLE_METRO_JOURNEY.minutes} min`, sub: `${SAMPLE_METRO_JOURNEY.stations} stops` },
              { label: "Distance", value: `${SAMPLE_METRO_JOURNEY.km} km`, sub: "avg 32 km/h" },
            ].map((s) => (
              <div key={s.label} className="rounded-[22px] bg-white p-3 text-center shadow-sm">
                <p className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
                <p className="mt-1 text-[16px] font-extrabold text-slate-900">{s.value}</p>
                <p className="text-[9.5px] text-slate-400">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* route progress */}
          <div className="mt-3">
            <MetroRouteProgress stations={METRO_ROUTE_INFO} current={trainAt} />
          </div>

          {/* book CTA */}
          <button
            onClick={() => openOverlay("metroBooking")}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[22px] bg-[#1A56DB] py-3.5 text-[13px] font-bold text-white shadow-lg shadow-blue-600/25 transition active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-5l-3 3-3-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm3 4v2h10V8H7zm0 4v2h7v-2H7z" />
            </svg>
            Book metro ticket
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeup {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
