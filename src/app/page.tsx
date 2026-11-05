"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Chennai One — root view switcher.
//
//   📱 Citizen app  — the Chennai One phone (commuter side: tickets, live
//                     tracking, City Pulse, incident ALERTS near their area)
//   🛡 Admin console — CUMTA Transit Operations Command (incident reports
//                     pop up live; duty officers resolve them)
//
// The two halves of one product: reports detected from the social data
// stream surface in the console, and their advisories reach the citizens
// nearby on the phone.

import { useEffect, useState } from "react";
import { ChennaiOneApp } from "@/components/app/ChennaiOneApp";
import { AdminConsole } from "@/components/app/AdminConsole";

type View = "app" | "admin";

function ViewSwitch({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <div className="fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-[#0B0F19]/90 p-1 shadow-2xl shadow-black/40 backdrop-blur">
      <span className="ml-2 hidden h-6 w-6 items-center justify-center sm:flex" aria-hidden>
        <svg viewBox="0 0 96 96" className="h-5 w-5">
          <path d="M48 14 84 78 H12 Z" fill="#fff" opacity="0.9" />
          <circle cx="48" cy="26" r="4" fill="#1A56DB" />
          <circle cx="26" cy="66" r="4" fill="#1A56DB" />
          <circle cx="70" cy="66" r="4" fill="#1A56DB" />
        </svg>
      </span>
      <button
        onClick={() => setView("app")}
        aria-pressed={view === "app"}
        className={`rounded-full px-4 py-1.5 text-[12px] font-extrabold tracking-wide transition ${
          view === "app" ? "bg-white text-[#0B0F19] shadow" : "text-slate-400 hover:text-white"
        }`}
      >
        📱 Citizen App
      </button>
      <button
        onClick={() => setView("admin")}
        aria-pressed={view === "admin"}
        className={`rounded-full px-4 py-1.5 text-[12px] font-extrabold tracking-wide transition ${
          view === "admin" ? "bg-white text-[#0B0F19] shadow" : "text-slate-400 hover:text-white"
        }`}
      >
        🛡 Admin Console
      </button>
    </div>
  );
}

export default function Home() {
  // restore the saved view without a render-cascading effect
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "app";
    const saved = window.localStorage.getItem("chennai-one:view");
    return saved === "admin" ? "admin" : "app";
  });

  useEffect(() => {
    window.localStorage.setItem("chennai-one:view", view);
  }, [view]);

  return (
    <>
      <ViewSwitch view={view} setView={setView} />
      {view === "admin" ? <AdminConsole /> : <ChennaiOneApp />}
    </>
  );
}
