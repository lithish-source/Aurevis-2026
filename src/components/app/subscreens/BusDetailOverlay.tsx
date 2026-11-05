"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-store";
import { OverlayShell } from "@/components/app/OverlayShell";
import { RouteMapLeaflet } from "@/components/app/maps";
import { BusArt, MetroTrainArt } from "@/components/app/Art";
import { LIVE_BUSES, BUS_ROUTE_578_GEO, BUS_STOPS_578, BUS_ALERTS } from "@/lib/transit-data";
import { reportTicket } from "@/lib/reporting";
import { cn } from "@/lib/utils";

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

export function BusDetailOverlay() {
  const { closeOverlay, setTab } = useApp();
  const [progress, setProgress] = useState(0.52);
  const [count, setCount] = useState(1332); // 22:12
  const bus = LIVE_BUSES[0];

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => (p >= 0.95 ? 0.5 : p + 0.003));
      setCount((c) => (c > 0 ? c - 1 : 1800));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(count / 60)).padStart(2, "0");
  const ss = String(count % 60).padStart(2, "0");

  return (
    <OverlayShell
      title="Live Tracking"
      onClose={closeOverlay}
      headerClass="bg-white text-slate-900"
      footer={
        <div className="flex gap-3">
          <button
            onClick={closeOverlay}
            className="flex-1 rounded-2xl border border-slate-200 py-3 text-[13.5px] font-bold text-slate-700 transition active:scale-[0.98]"
          >
            Track only
          </button>
          <button
            onClick={async () => {
              await reportTicket({
                mode: "bus",
                routeNo: bus.routeNo,
                from: "Ramapuram SRM University",
                to: bus.destination,
                passengers: 1,
                fare: bus.fare,
              });
              setTab("tickets");
            }}
            className="flex-[1.6] rounded-2xl bg-[#E53935] py-3 text-[13.5px] font-bold text-white shadow-lg shadow-rose-900/20 transition active:scale-[0.98]"
          >
            Book this bus · ₹{bus.fare}
          </button>
        </div>
      }
    >
      {/* ── map (real Leaflet route map) ── */}
      <div className="relative">
        <RouteMapLeaflet
          className="h-[290px] w-full"
          stops={BUS_ROUTE_578_GEO}
          progress={progress}
          vehicle="bus"
          eta={{ stopIndex: 4, text: "22 min" }}
          detailsButton={false}
        />
        {/* route chip top-left */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 shadow-lg shadow-black/15">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F6B733] text-[10px] font-extrabold text-[#5C4308]">578</span>
          <span className="text-[11.5px] font-bold text-slate-700">Sriperumbudur Bus</span>
        </div>
      </div>

      <div className="px-4 pb-6 pt-4">
        {/* ── bus info card ── */}
        <div className="rounded-[22px] bg-white p-4 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-extrabold text-slate-900">578 - {bus.name}</p>
              <p className="mt-0.5 text-[12px] text-slate-500">{bus.via}</p>
              <p className="mt-1 text-[12px] font-semibold text-slate-700">
                Arrives {bus.arrivalTime} · {bus.destination}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-[#FDF1DE] px-2.5 py-1 text-[10.5px] font-bold text-[#E8890C]">{bus.status}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10.5px] font-bold text-slate-600">{bus.type}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10.5px] font-bold text-slate-600">{bus.occupancy} crowd</span>
              </div>
            </div>
            <BusArt className="h-20 w-28 shrink-0" />
          </div>

          {/* countdown */}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F1F3F6] px-4 py-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Arriving in</p>
              <p className="font-mono text-[24px] font-extrabold leading-tight text-[#1E9E5A]" style={{ textShadow: "0 0 12px rgba(30,158,90,0.35)" }}>
                {mm}:{ss}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Current stop</p>
              <p className="text-[13px] font-bold text-slate-700">Poonamallee Terminus</p>
              <p className="text-[10.5px] text-slate-400">{bus.stopsAway} stops away</p>
            </div>
          </div>
        </div>

        {/* ── stop timeline ── */}
        <h3 className="mb-2.5 mt-5 text-[14.5px] font-bold text-slate-800">Stop-by-stop</h3>
        <div className="rounded-[22px] bg-white p-4 shadow-sm">
          {BUS_STOPS_578.map((s, i) => (
            <div key={s.name} className="relative flex items-center gap-3 pb-4 last:pb-0">
              {/* rail */}
              {i < BUS_STOPS_578.length - 1 && (
                <span className={cn("absolute bottom-[-4px] left-[7px] top-5 w-0.5 rounded", s.passed ? "bg-[#1A56DB]" : "bg-slate-200")} />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[3px]",
                  s.passed ? "border-[#1A56DB] bg-white" : i === 4 ? "border-[#E53935] bg-white ring-4 ring-[#E53935]/15" : "border-slate-300 bg-white"
                )}
              >
                {s.passed && <span className="h-1.5 w-1.5 rounded-full bg-[#1A56DB]" />}
              </span>
              <span className={cn("flex-1 text-[12.5px]", s.passed ? "font-semibold text-slate-700" : i === 4 ? "font-bold text-[#E53935]" : "font-medium text-slate-500")}>
                {s.name}
                {i === 4 && <span className="ml-2 rounded-full bg-[#E53935]/10 px-2 py-0.5 text-[9.5px] font-bold text-[#E53935]">Bus here</span>}
              </span>
              <span className={cn("font-mono text-[11px]", s.passed ? "text-slate-300 line-through" : "font-semibold text-slate-600")}>{s.eta}</span>
            </div>
          ))}
        </div>

        {/* ── alerts ── */}
        <h3 className="mb-2.5 mt-5 text-[14.5px] font-bold text-slate-800">Updates</h3>
        <div className="flex flex-col gap-2.5">
          {BUS_ALERTS.map((a) => (
            <div key={a.title} className="flex gap-3 rounded-2xl bg-white p-3.5 shadow-sm">
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
    </OverlayShell>
  );
}

/** Metro timetable sheet with 7-segment countdown (from the CMRL timetable reference). */
export function TimetableOverlay() {
  const { closeOverlay } = useApp();
  const [count, setCount] = useState(73); // 01:13

  useEffect(() => {
    const t = setInterval(() => setCount((c) => (c > 0 ? c - 1 : 420)), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(count / 60)).padStart(2, "0");
  const ss = String(count % 60).padStart(2, "0");

  return (
    <OverlayShell title="Timetable" onClose={closeOverlay} headerClass="bg-white text-slate-900">
      <div className="px-4 pb-8 pt-4">
        <MetroTrainArt className="mx-auto w-full max-w-[330px]" />

        <h2 className="mt-2 text-center text-[19px] font-bold leading-snug text-slate-900">
          Metro arrives at <br /> Meenambakkam
        </h2>

        {/* 7-segment countdown */}
        <div className="mt-4 flex items-center justify-center gap-2" aria-live="polite">
          {[...mm].map((d, i) => (
            <span
              key={`m${i}`}
              className="rounded-lg bg-[#0E2A1A] px-2.5 py-2 font-mono text-[44px] font-bold leading-none text-[#2FE888]"
              style={{ textShadow: "0 0 16px rgba(47,232,136,0.6)" }}
            >
              {d}
            </span>
          ))}
          <span className="flex flex-col gap-3 px-0.5">
            <span className="block h-3 w-3 rounded-full bg-[#2FE888]" />
            <span className="block h-3 w-3 rounded-full bg-[#2FE888]" />
          </span>
          {[...ss].map((d, i) => (
            <span
              key={`s${i}`}
              className="rounded-lg bg-[#0E2A1A] px-2.5 py-2 font-mono text-[44px] font-bold leading-none text-[#2FE888]"
              style={{ textShadow: "0 0 16px rgba(47,232,136,0.6)" }}
            >
              {d}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-center text-[12px] font-medium text-slate-500">Metro arrives at 🕐 11:54 AM</p>

        {/* frequency card */}
        <div className="mt-5 rounded-[22px] bg-white p-4 shadow-sm">
          <p className="text-[14px] font-bold text-slate-800">11:37 AM - 11:54 AM</p>
          <p className="mt-0.5 text-[11.5px] text-slate-500">Metros arrive every 7 minutes during this period.</p>

          {/* train chip timeline */}
          <div className="mt-4 flex items-center gap-1.5">
            {[...Array(7)].map((_, i) => {
              const past = i < 3;
              return (
                <span
                  key={i}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    past ? "bg-slate-200 text-slate-400" : "bg-[#E4EEF3] text-[#3B4FA0] ring-2 ring-[#3B4FA0]/20"
                  )}
                >
                  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden>
                    <path d="M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-1l1.7 3h-2.4L13.6 18h-3.2L8.7 21H6.3L8 18H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
                  </svg>
                </span>
              );
            })}
          </div>

          {/* time ruler */}
          <div className="relative mt-3">
            <div className="flex justify-between font-mono text-[9px] text-slate-400">
              {["11:15", "11:30", "11:45", "12:00", "12:15"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <div className="relative mt-1 h-1 rounded-full bg-slate-100">
              <span className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-full bg-[#E53935]" />
            </div>
            {/* current time tooltip */}
            <span className="absolute -top-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#FCD26A] px-2 py-0.5 text-[10px] font-bold text-[#5C4308] shadow-sm">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" fill="none" stroke="#5C4308" strokeWidth="2" strokeLinecap="round" />
              </svg>
              11:53
            </span>
          </div>
        </div>

        {/* second frequency block */}
        <div className="mt-3 flex items-center gap-3 rounded-[18px] border-l-4 border-[#3B67AF] bg-white p-4 shadow-sm">
          <div className="flex-1">
            <p className="text-[13.5px] font-bold text-slate-800">11:54 AM - 12:10 PM</p>
            <p className="text-[11px] text-slate-500">Headway changes after peak</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-mono text-[13px] font-bold text-[#1E9E5A]">08</span>
        </div>
      </div>
    </OverlayShell>
  );
}
