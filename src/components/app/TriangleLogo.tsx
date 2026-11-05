"use client";

import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Chennai One triangle route mark — the app's logo (also used for the favicon
// and splash screen). Drawn inline so it inherits currentColor accents.

export function TriangleLogo({ className = "h-10 w-10", mono = false }: { className?: string; mono?: boolean }) {
  const tile = mono ? "#1B1F26" : "url(#c1tile)";
  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label="Chennai One logo" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="c1tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#232E6B" />
          <stop offset="0.55" stopColor="#1A56DB" />
          <stop offset="1" stopColor="#1A6FE0" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="26" fill={tile} />
      <path d="M48 26 L73.5 68.5 L22.5 68.5 Z" fill="none" stroke="#FFFFFF" strokeWidth="6.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="48" cy="26" r="7" fill="#FFFFFF" />
      <circle cx="22.5" cy="68.5" r="7" fill="#FFFFFF" />
      <circle cx="73.5" cy="68.5" r="7" fill="#FFFFFF" />
      <circle cx="48" cy="26" r="3.2" fill={mono ? "#1B1F26" : "#1A56DB"} />
      <path d="M32 80 H64" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 8" />
    </svg>
  );
}

/** Full boot splash shown briefly inside the phone screen. */
export function Splash({ leaving }: { leaving?: boolean }) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-[80] flex flex-col items-center justify-center bg-[radial-gradient(120%_90%_at_50%_0%,#1D3E8F_0%,#12224E_55%,#0B1730_100%)] text-white",
        leaving && "animate-[splashout_0.45s_ease_forwards]"
      )}
      aria-hidden={leaving}
    >
      <div className="animate-[splashin_0.6s_cubic-bezier(0.22,1,0.36,1)_both]">
        <TriangleLogo className="h-24 w-24 drop-shadow-[0_10px_30px_rgba(26,111,224,0.55)]" />
      </div>
      <p className="mt-5 text-[21px] font-extrabold tracking-[0.22em]">CHENNAI ONE</p>
      <p className="mt-1.5 text-[11px] font-semibold tracking-[0.3em] text-sky-200/80">BUS · METRO · TRAIN</p>
      <div className="absolute bottom-9 flex items-center gap-2 text-[9.5px] font-medium text-slate-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
        An initiative of CUMTA · Govt. of Tamil Nadu
      </div>
    </div>
  );
}
