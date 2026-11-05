"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/app-store";
import { OverlayShell } from "@/components/app/OverlayShell";
import {
  METRO_LINE_1,
  METRO_LINE_2,
  METRO_ROUTE_INFO,
  SAMPLE_METRO_JOURNEY,
} from "@/lib/transit-data";
import { cn } from "@/lib/utils";

function DotRail() {
  return (
    <div className="flex w-4 shrink-0 flex-col items-center self-stretch pt-4">
      <span className="h-3.5 w-3.5 rounded-full bg-[#1E9E5A] ring-4 ring-[#1E9E5A]/20" />
      <span className="my-1.5 w-0.5 flex-1 border-l-2 border-dotted border-slate-300" />
      <svg viewBox="0 0 24 24" className="-mb-1 h-5 w-5 text-[#E53935]" fill="currentColor" aria-hidden>
        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
      </svg>
    </div>
  );
}

function StatCell({
  label,
  value,
  suffix,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  valueClass: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-1 py-3.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-[10px] font-semibold text-slate-500">{label}</span>
      <span className={cn("text-[19px] font-extrabold leading-none", valueClass)}>
        {value}
        {suffix && <span className="ml-0.5 text-[10px] font-bold text-slate-400">{suffix}</span>}
      </span>
    </div>
  );
}

export function PlannerOverlay() {
  const { closeOverlay, plannerMode } = useApp();
  const allStations = useMemo(() => [...METRO_LINE_1, ...METRO_LINE_2], []);
  const [from, setFrom] = useState("Meenambakkam");
  const [to, setTo] = useState("Government Estate");
  const [showFromList, setShowFromList] = useState(false);
  const [showToList, setShowToList] = useState(false);
  const [date, setDate] = useState("Today");
  const [time, setTime] = useState("Now");
  const [routeOpen, setRouteOpen] = useState(true);

  const modeLabel = plannerMode === "metro" ? "Metro" : plannerMode === "train" ? "Train" : plannerMode === "search" ? "All modes" : "Bus";
  const stopWord = plannerMode === "bus" ? "Stops" : plannerMode === "train" ? "Stations" : "Stations";

  const suggestions = allStations
    .filter((s) => s.name !== (showFromList ? to : from))
    .slice(0, 30);

  return (
    <OverlayShell title="Travel Planner" onClose={closeOverlay}>
      <div className="px-4 pb-8 pt-3">
        {/* from / to inputs with rail */}
        <div className="rounded-[22px] bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <DotRail />
            <div className="flex flex-1 flex-col gap-3">
              <button
                onClick={() => {
                  setShowFromList(!showFromList);
                  setShowToList(false);
                }}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-left transition active:bg-slate-50"
              >
                <span className="text-[13.5px] font-semibold text-slate-800">{from}</span>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setShowToList(!showToList);
                  setShowFromList(false);
                }}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-left transition active:bg-slate-50"
              >
                <span className="text-[13.5px] font-semibold text-slate-800">{to}</span>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>

          {showFromList && (
            <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60">
              {suggestions.map((s) => (
                <button
                  key={s.line + s.name}
                  onClick={() => {
                    setFrom(s.name);
                    setShowFromList(false);
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[12.5px] transition hover:bg-white"
                >
                  <span className="font-medium text-slate-700">{s.name}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-bold", s.line === "Blue" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700")}>
                    {s.line}
                  </span>
                </button>
              ))}
            </div>
          )}
          {showToList && (
            <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60">
              {suggestions.map((s) => (
                <button
                  key={s.line + s.name}
                  onClick={() => {
                    setTo(s.name);
                    setShowToList(false);
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[12.5px] transition hover:bg-white"
                >
                  <span className="font-medium text-slate-700">{s.name}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-bold", s.line === "Blue" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700")}>
                    {s.line}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* date & time */}
        <h2 className="mb-2.5 mt-5 text-[14.5px] font-bold text-[#2E4057]">Select Date &amp; Time</h2>
        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center gap-2 rounded-xl bg-[#E4EEF3] px-3.5 py-3 text-[13px] font-semibold text-[#2E4057] transition active:scale-95">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-[#3B67AF]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
              <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
            </svg>
            {date}
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-[#E4EEF3] px-3.5 py-3 text-[13px] font-semibold text-[#2E4057] transition active:scale-95">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-[#3B67AF]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            {time}
          </button>
        </div>

        {/* journey summary grid */}
        <h2 className="mb-2.5 mt-5 text-[14.5px] font-bold text-[#2E4057]">Journey Summary</h2>
        <div className="grid grid-cols-4 divide-x divide-slate-100 rounded-[22px] bg-white py-1 shadow-sm">
          <StatCell
            label="Ticket Fare"
            value="₹40"
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#2E4057" aria-hidden>
                <path d="M4 5h16a1 1 0 0 1 1 1v3.5a2.5 2.5 0 0 0 0 5V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3.5a2.5 2.5 0 0 0 0-5V6a1 1 0 0 1 1-1zm8 3.2-1 2-2.2.3 1.6 1.5-.4 2.2 2-1 2 1-.4-2.2 1.6-1.5-2.2-.3-1-2z" />
              </svg>
            }
            valueClass="text-[#2E4057]"
          />
          <StatCell
            label={stopWord}
            value="10"
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#C03A50" aria-hidden>
                <path d="M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-1l1.7 3h-2.4L13.6 18h-3.2L8.7 21H6.3L8 18H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm1 3v6h8V6H8z" />
              </svg>
            }
            valueClass="text-[#C03A50]"
          />
          <StatCell
            label="Travel Time"
            value="29"
            suffix="Min"
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#A8A32A" aria-hidden>
                <path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm1 4v5.4l-4 2.3-1-1.7 3-1.7V7z" />
              </svg>
            }
            valueClass="text-[#8F8A1E]"
          />
          <StatCell
            label="Distance"
            value="14.7"
            suffix="Kms"
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#2196C9" aria-hidden>
                <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
              </svg>
            }
            valueClass="text-[#2196C9]"
          />
        </div>

        {/* upcoming departures */}
        <h2 className="mb-2.5 mt-5 text-[14.5px] font-bold text-[#2E4057]">
          Upcoming {modeLabel} Details
        </h2>
        <div className="overflow-hidden rounded-[22px] bg-white shadow-sm">
          {/* service hours banner */}
          <div className="flex items-center justify-between bg-[#4A73B8] px-5 py-2.5 text-white">
            <span className="flex items-center gap-2 text-[12px] font-semibold">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <circle cx="12" cy="12" r="5" />
                <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {SAMPLE_METRO_JOURNEY.firstTrain}
            </span>
            <span className="flex items-center gap-2 text-[12px] font-semibold">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6a8.5 8.5 0 1 0 10.6 10.6z" />
              </svg>
              {SAMPLE_METRO_JOURNEY.lastTrain}
            </span>
          </div>

          {/* departure chips */}
          <div className="relative px-4 py-5">
            <div className="flex justify-between">
              {SAMPLE_METRO_JOURNEY.trains.map((t, i) => (
                <div key={t.time} className="flex flex-col items-center gap-1.5">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3B4FA0] text-[13px] font-bold text-white shadow-sm">
                    {t.time}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{t.code}</span>
                  {i === 0 && (
                    <span className="absolute -top-0.5 left-[64px] flex items-center gap-1 rounded-xl bg-[#E4EEF3] px-2.5 py-1 text-[10px] font-bold text-[#3B67AF] shadow-sm">
                      <span className="block h-1.5 w-1.5 rounded-full bg-[#3B67AF]" />
                      Direct train
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* route information */}
          <button
            onClick={() => setRouteOpen((o) => !o)}
            className="flex w-full items-center justify-between border-t border-slate-100 bg-[#F1F3F6] px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-[12.5px] font-bold text-[#3B67AF]">
              <span className="block h-4 w-1 rounded-full bg-[#2E4057]" />
              Route Information
            </span>
            <svg
              viewBox="0 0 24 24"
              className={cn("h-4 w-4 text-slate-500 transition-transform", routeOpen ? "rotate-180" : "")}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {routeOpen && (
            <div className="border-t border-slate-100 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="relative mt-1.5 flex flex-col items-center">
                  <span className="h-3 w-3 rounded-full bg-[#1E9E5A]" />
                  <span className="my-1 w-0.5 flex-1 border-l-2 border-dotted border-slate-300" />
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#E53935]" fill="currentColor" aria-hidden>
                    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  {METRO_ROUTE_INFO.map((s, i) => (
                    <div key={s} className="flex items-center justify-between py-[5px]">
                      <span className={cn("text-[12.5px]", i === 0 || i === METRO_ROUTE_INFO.length - 1 ? "font-bold text-slate-800" : "font-medium text-slate-500")}>
                        {s}
                      </span>
                      {i === 2 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700">Interchange</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[10.5px] leading-relaxed text-slate-400">
          Fares shown are indicative. Tickets are issued as QR codes valid for a single journey.
        </p>
      </div>
    </OverlayShell>
  );
}
