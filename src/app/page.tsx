"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Chennai One — Portal Landing Page
//
// Presents a clean "choose your portal" screen:
//   📱 Citizen App   → /app   (commuter side)
//   🛡  Admin Console → /admin (CUMTA duty-officer console)
//
// Each portal lives at its own URL, so both can be opened side-by-side in
// separate tabs and bookmarked independently.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { TriangleLogo } from "@/components/app/TriangleLogo";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(130%_120%_at_20%_0%,#101a33_0%,#0B0F19_55%,#070A12_100%)] px-4">
      <div className="w-full max-w-sm">
        {/* brand header */}
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <TriangleLogo className="h-16 w-16 drop-shadow-xl" />
          <h1 className="text-[26px] font-extrabold tracking-tight text-white">Chennai One</h1>
          <p className="text-[13px] font-medium leading-relaxed text-slate-400">
            CUMTA citizen transit app &amp; operations command.
            <br />
            Choose your portal to continue.
          </p>
        </div>

        {/* portal cards */}
        <div className="flex flex-col gap-4">
          {/* Citizen App card */}
          <Link
            href="/app"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-700/60 bg-[#111827]/80 p-5 shadow-lg shadow-black/30 backdrop-blur transition hover:border-slate-500/60 hover:bg-[#1a2540]/80 active:scale-[0.98]"
          >
            {/* gradient accent bar */}
            <span className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-[#D618E8] via-[#F0143C] to-[#F25C05]" />
            <span className="ml-2 flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#D618E8]/20 to-[#F25C05]/20 text-3xl">
              📱
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-extrabold text-white">Citizen App</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-400">
                Tickets, live bus tracking, journey planner, City Pulse &amp; incident alerts
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>

          {/* Admin Console card */}
          <Link
            href="/admin"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-700/60 bg-[#111827]/80 p-5 shadow-lg shadow-black/30 backdrop-blur transition hover:border-indigo-500/40 hover:bg-[#111f38]/80 active:scale-[0.98]"
          >
            {/* gradient accent bar */}
            <span className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-[#1A56DB] to-[#4F46E5]" />
            <span className="ml-2 flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1A56DB]/20 to-[#4F46E5]/20 text-3xl">
              🛡️
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-extrabold text-white">Admin Console</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-400">
                CUMTA Transit Operations Command — incident reports, social stream &amp; spatial visualiser
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        <p className="mt-8 text-center text-[10px] font-semibold text-slate-600">
          Chennai One · CUMTA · Government of Tamil Nadu
        </p>
      </div>
    </div>
  );
}
