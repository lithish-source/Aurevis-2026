"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-store";
import {
  MODE_CARDS,
  NEARBY_ROUTES,
  NEARBY_STOP,
  USER_AREA,
  USER_LOCATION,
  type ModeCardId,
} from "@/lib/transit-data";
import { CityMapLeaflet } from "@/components/app/maps";
import { AreaAlertBanner } from "@/components/app/AlertsCenter";
import { reportEvent } from "@/lib/reporting";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Chennai One v3 (CUMTA) home screen:
//   • illustrated map hero + gradient search bar
//   • draggable bottom sheet — pull it down to reveal the full neighbourhood
//     map with bus stops, metro stations and railway stations (toggleable)
//   • mode carousel (Bus / Metro / Train / Auto / Taxi)
//   • ₹1 Rupee Ticket promo carousel
//   • "Track your buses" nearby route cards

const SNAP_MAP = 0.34; // sheet collapsed → full map
const SNAP_HOME = 0.76; // default
const SNAP_FULL = 0.95; // dragged up → nearly full content

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ─── shared status block ─────────────────────────────────────────────────────

function AreaStatus({ mapMode = false }: { mapMode?: boolean }) {
  return (
    <div className="px-6 text-center">
      <p className="text-[15px] font-semibold leading-snug text-[#111]">
        You are in <span aria-hidden>↗</span>{" "}
        <span className="underline underline-offset-2 decoration-[#111]/60">{USER_AREA}.</span>
      </p>
      <p className="mt-0.5 text-[12.5px] font-medium text-[#3C3C43]">
        {mapMode ? "Bus stops, metro & railway stations nearby." : "No buses available around you."}
      </p>
    </div>
  );
}

// ─── hero illustration (sky + skyline + trees) ───────────────────────────────

function HeroScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 240" className={cn("h-full w-full", className)} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#BEE9F5" />
          <stop offset="1" stopColor="#EAF8FB" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#heroSky)" />
      {/* sun glow */}
      <circle cx="346" cy="36" r="24" fill="#FFF6D8" opacity="0.55" />
      <circle cx="346" cy="36" r="14" fill="#FFF3C4" />
      {/* clouds */}
      <g fill="#FFFFFF" opacity="0.9">
        <ellipse cx="64" cy="42" rx="27" ry="10" />
        <ellipse cx="90" cy="48" rx="18" ry="7.5" />
        <ellipse cx="188" cy="26" rx="21" ry="8" />
        <ellipse cx="292" cy="62" rx="30" ry="11" />
        <ellipse cx="322" cy="68" rx="18" ry="7.5" />
      </g>
      {/* distant skyline */}
      <g fill="#CBE7F1">
        <rect x="30" y="126" width="20" height="30" rx="2" />
        <rect x="56" y="136" width="14" height="20" rx="2" />
        <rect x="92" y="120" width="24" height="36" rx="2" />
        <rect x="124" y="132" width="16" height="24" rx="2" />
        <rect x="196" y="124" width="18" height="32" rx="2" />
        <rect x="222" y="134" width="26" height="22" rx="2" />
        <rect x="288" y="122" width="20" height="34" rx="2" />
        <rect x="316" y="132" width="15" height="24" rx="2" />
        <rect x="348" y="126" width="22" height="30" rx="2" />
      </g>
      {/* tree line */}
      <g>
        {[
          { x: 24, c: "#6FA84F", r: 20 },
          { x: 66, c: "#4E8B3C", r: 16 },
          { x: 106, c: "#86BA5E", r: 19 },
          { x: 152, c: "#5C9440", r: 22 },
          { x: 200, c: "#6FA84F", r: 17 },
          { x: 244, c: "#4E8B3C", r: 21 },
          { x: 292, c: "#86BA5E", r: 16 },
          { x: 334, c: "#5C9440", r: 20 },
          { x: 378, c: "#6FA84F", r: 17 },
        ].map((t, i) => (
          <g key={i}>
            <rect x={t.x - 3} y="196" width="6" height="44" rx="2.5" fill="#8B5A2B" />
            <circle cx={t.x} cy="188" r={t.r} fill={t.c} />
            <circle cx={t.x - t.r * 0.45} cy={188 - t.r * 0.35} r={t.r * 0.55} fill="#FFFFFF" opacity="0.14" />
          </g>
        ))}
      </g>
      {/* bushes */}
      <g fill="#9CCB86">
        <ellipse cx="46" cy="232" rx="26" ry="11" />
        <ellipse cx="132" cy="236" rx="30" ry="12" />
        <ellipse cx="228" cy="232" rx="26" ry="11" />
        <ellipse cx="322" cy="236" rx="30" ry="12" />
      </g>
    </svg>
  );
}

function WalkingPin({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 62" className={className} aria-hidden>
      <ellipse cx="24" cy="58" rx="10" ry="2.6" fill="#111" opacity="0.16" />
      <path d="M24 56 C13.5 44.5 6 37.5 6 27 A18 18 0 1 1 42 27 C42 37.5 34.5 44.5 24 56 Z" fill="#1565C0" stroke="#FFFFFF" strokeWidth="3" />
      <g fill="#FFFFFF" transform="translate(24 27)">
        <circle cx="0" cy="-8.6" r="3.1" />
        <path d="M-0.5 -4.8 L2 1.4 L5.6 4.8 L4.2 6.8 L0.5 4 L-1 -0.4 L-3.8 4 L-6.7 5.9 L-7.9 3.8 L-5.3 1.6 L-2.7 -4.4 Z" />
      </g>
    </svg>
  );
}

// ─── mode card illustrations ─────────────────────────────────────────────────

function ModeArt({ id }: { id: ModeCardId }) {
  if (id === "bus")
    return (
      <svg viewBox="0 0 80 58" className="h-[46px]" aria-hidden>
        <ellipse cx="40" cy="52" rx="27" ry="4" fill="#111" opacity="0.1" />
        <rect x="14" y="8" width="52" height="40" rx="7" fill="#FFFFFF" stroke="#E1E5EB" strokeWidth="1.5" />
        <path d="M15.5 36 H64.5 V41 A7 7 0 0 1 57.5 48 H22.5 A7 7 0 0 1 15.5 41 Z" fill="#1A6FE0" />
        <rect x="31" y="10.5" width="18" height="4.5" rx="2.2" fill="#FFD84D" stroke="#E8C21B" strokeWidth="0.8" />
        <rect x="20" y="17" width="40" height="14" rx="3.5" fill="#23364F" />
        <rect x="26" y="19.5" width="12" height="9" rx="2" fill="#9FC4E8" />
        <rect x="42" y="19.5" width="12" height="9" rx="2" fill="#9FC4E8" />
        <circle cx="24" cy="41.5" r="2.6" fill="#FFF3C4" />
        <circle cx="56" cy="41.5" r="2.6" fill="#FFF3C4" />
        <rect x="18" y="47" width="9" height="5.5" rx="2.4" fill="#23364F" />
        <rect x="53" y="47" width="9" height="5.5" rx="2.4" fill="#23364F" />
      </svg>
    );
  if (id === "metro")
    return (
      <svg viewBox="0 0 80 58" className="h-[54px]" aria-hidden>
        <ellipse cx="40" cy="52" rx="24" ry="4" fill="#111" opacity="0.1" />
        <path d="M20 48 V16 A14 14 0 0 1 34 4 H46 A14 14 0 0 1 60 16 V48 Z" fill="#F5F8FC" stroke="#D8DFE9" strokeWidth="1.5" />
        <path d="M22 8.5 C26 5.5 31 4 40 4 C49 4 54 5.5 58 8.5 L56 14 H24 Z" fill="#1A6FE0" />
        <rect x="25" y="17" width="30" height="14" rx="4" fill="#23364F" />
        <rect x="28.5" y="19.5" width="10" height="9" rx="2" fill="#9FC4E8" />
        <rect x="41.5" y="19.5" width="10" height="9" rx="2" fill="#9FC4E8" />
        <path d="M20 36 H60" stroke="#1A6FE0" strokeWidth="4" strokeLinecap="round" />
        <circle cx="28" cy="43.5" r="2.8" fill="#FFD84D" />
        <circle cx="52" cy="43.5" r="2.8" fill="#FFD84D" />
        <rect x="34" y="46" width="12" height="4" rx="2" fill="#8B95A5" />
      </svg>
    );
  if (id === "train")
    return (
      <svg viewBox="0 0 80 58" className="h-[54px]" aria-hidden>
        <ellipse cx="40" cy="52" rx="26" ry="4" fill="#111" opacity="0.1" />
        <path d="M18 48 V18 A12 12 0 0 1 30 6 H50 A12 12 0 0 1 62 18 V48 Z" fill="#1E6B34" />
        <path d="M22 48 V20 A9 9 0 0 1 31 11 H49 A9 9 0 0 1 58 20 V48 Z" fill="#F2C94C" />
        <rect x="27" y="15" width="26" height="11" rx="3" fill="#23364F" />
        <rect x="30" y="17.5" width="9" height="6" rx="1.5" fill="#9FC4E8" />
        <rect x="41" y="17.5" width="9" height="6" rx="1.5" fill="#9FC4E8" />
        <circle cx="28" cy="38" r="3" fill="#23364F" />
        <circle cx="52" cy="38" r="3" fill="#23364F" />
        <rect x="24" y="45" width="32" height="5" rx="2.5" fill="#23364F" />
        <rect x="14" y="42" width="5" height="4" rx="1.5" fill="#5A6B7A" />
        <rect x="61" y="42" width="5" height="4" rx="1.5" fill="#5A6B7A" />
      </svg>
    );
  if (id === "auto")
    return (
      <svg viewBox="0 0 80 58" className="h-[54px]" aria-hidden>
        <ellipse cx="40" cy="52" rx="22" ry="3.6" fill="#111" opacity="0.1" />
        <path d="M24 30 C24 16 32 9 40 9 C48 9 56 16 56 30 Z" fill="#FFD84D" stroke="#E8C21B" strokeWidth="1.2" />
        <rect x="22" y="29" width="36" height="16" rx="5" fill="#1E9E5A" />
        <path d="M28 30 C28 22 33 17 40 17 C47 17 52 22 52 30 Z" fill="#23364F" />
        <rect x="35" y="21" width="10" height="6" rx="1.5" fill="#9FC4E8" />
        <circle cx="40" cy="49" r="6" fill="#23364F" />
        <circle cx="40" cy="49" r="2.2" fill="#B9C2D0" />
        <rect x="24" y="45" width="8" height="5.5" rx="2.4" fill="#23364F" />
        <rect x="48" y="45" width="8" height="5.5" rx="2.4" fill="#23364F" />
        <rect x="37" y="6" width="6" height="4" rx="2" fill="#8B5A2B" />
      </svg>
    );
  return (
    <svg viewBox="0 0 80 58" className="h-[54px]" aria-hidden>
      <ellipse cx="40" cy="52" rx="26" ry="4" fill="#111" opacity="0.1" />
      <path d="M14 40 L18 28 C19 25 21 23.5 24 23.5 H56 C59 23.5 61 25 62 28 L66 40 Z" fill="#23364F" />
      <rect x="12" y="39" width="56" height="9" rx="3.5" fill="#FFD84D" />
      <rect x="22" y="26" width="14" height="11" rx="2" fill="#9FC4E8" />
      <rect x="40" y="26" width="14" height="11" rx="2" fill="#9FC4E8" />
      <rect x="36" y="26" width="4" height="11" fill="#23364F" />
      <rect x="28" y="18" width="22" height="6" rx="3" fill="#FFD84D" />
      <rect x="37" y="12" width="4" height="7" fill="#23364F" />
      <circle cx="24" cy="49" r="6" fill="#23364F" />
      <circle cx="24" cy="49" r="2.2" fill="#B9C2D0" />
      <circle cx="56" cy="49" r="6" fill="#23364F" />
      <circle cx="56" cy="49" r="2.2" fill="#B9C2D0" />
    </svg>
  );
}

// ─── ₹1 promo phone mockup ───────────────────────────────────────────────────

function RupeePhoneMock() {
  return (
    <div className="relative h-[96px] w-[58px] shrink-0 rounded-[14px] bg-[#1E1E1E] p-[4px] shadow-md">
      <div className="flex h-full w-full flex-col items-center rounded-[10px] bg-gradient-to-b from-[#4B7BF5] to-[#3D66D8] px-1.5 py-1.5">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="currentColor" aria-hidden>
          <path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1v2.2a1 1 0 0 1-2 0V18h-2.5v2.2a1 1 0 0 1-2 0V18H9v2.2a1 1 0 0 1-2 0V18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1 3v6h12V6H6z" />
        </svg>
        <div className="mt-1 w-full rounded-md bg-white p-1.5">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#E8442E]" />
            <span className="text-[4.5px] font-extrabold leading-none text-[#111]">CUMTA UPI</span>
            <span className="ml-auto text-[6px] font-extrabold text-[#111]">₹1</span>
          </div>
          <div className="mt-1 rounded-[3px] bg-[#1A5CE5] py-[2.5px] text-center text-[4px] font-extrabold tracking-wide text-white">GET TICKET</div>
        </div>
        <span className="mt-auto text-[3.5px] font-bold text-sky-100/70">Powered by CUMTA</span>
      </div>
    </div>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { openOverlay, setPlannerMode, setLiveMode } = useApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const [sheetFrac, setSheetFrac] = useState(SNAP_HOME);
  const [dragging, setDragging] = useState(false);
  const press = useRef<{ y: number; frac: number; onSearch: boolean; moved: boolean } | null>(null);

  // pin layers
  const [showBus, setShowBus] = useState(true);
  const [showMetro, setShowMetro] = useState(true);
  const [showRailway, setShowRailway] = useState(true);

  // nearby stops — fetched live from the transit API
  const [nearby, setNearby] = useState<{
    count: number;
    counts: { bus: number; metro: number; railway: number };
    stops: { name: string; lat: number; lon: number; active?: boolean; category: string; distanceM: number }[];
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/transit/stops/nearby?lat=${USER_LOCATION.lat}&lon=${USER_LOCATION.lon}&mode=all&radius=7000`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setNearby(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // promo carousel
  const [promoIdx, setPromoIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPromoIdx((i) => (i + 1) % 4), 4500);
    return () => clearInterval(t);
  }, []);

  const mapProgress = clamp01((SNAP_HOME - sheetFrac) / (SNAP_HOME - SNAP_MAP));
  const inMapMode = mapProgress > 0.5;
  const ease = "cubic-bezier(0.22,1,0.36,1)";

  // ── drag handling (sheet header + hero) ──
  const startPress = (e: React.PointerEvent, onSearch: boolean) => {
    press.current = { y: e.clientY, frac: sheetFrac, onSearch, moved: false };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const movePress = (e: React.PointerEvent) => {
    if (!press.current) return;
    const dy = e.clientY - press.current.y;
    if (Math.abs(dy) > 6) press.current.moved = true;
    const h = containerRef.current?.clientHeight ?? 800;
    setSheetFrac(Math.max(0.26, Math.min(0.96, press.current.frac - dy / h)));
  };
  const endPress = (tapAction?: () => void) => {
    const p = press.current;
    press.current = null;
    setDragging(false);
    if (p && !p.moved) {
      if (p.onSearch) {
        openOverlay("search");
        return;
      }
      tapAction?.();
      return;
    }
    // snap to nearest resting point
    const snaps = [SNAP_MAP, SNAP_HOME, SNAP_FULL];
    const nearest = snaps.reduce((a, b) => (Math.abs(b - sheetFrac) < Math.abs(a - sheetFrac) ? b : a));
    setSheetFrac(nearest);
  };

  const onModeCard = (id: ModeCardId) => {
    reportEvent("mode_card_tap", { mode: id });
    if (id === "bus" || id === "metro" || id === "train") {
      setPlannerMode(id);
      openOverlay("planner");
    } else {
      openOverlay("search");
    }
  };

  const toggles: { label: string; on: boolean; set: (v: boolean) => void }[] = [
    { label: "Bus Stops", on: showBus, set: setShowBus },
    { label: "Metro Stns", on: showMetro, set: setShowMetro },
    { label: "Railway Stns", on: showRailway, set: setShowRailway },
  ];

  return (
    <div ref={containerRef} className="relative h-full overflow-hidden bg-[#F1F0F4]">
      {/* ═══ full neighbourhood map — real Leaflet map, revealed by pulling the sheet down ═══ */}
      <CityMapLeaflet
        className="absolute inset-0 z-0"
        showBus={showBus}
        showMetro={showMetro}
        showRailway={showRailway}
        stops={nearby?.stops}
      />

      {/* ═══ illustrated hero (home mode) ═══ */}
      <div
        className="absolute inset-x-0 top-0 z-10 h-[30%] cursor-pointer"
        style={{
          opacity: 1 - mapProgress,
          transition: dragging ? "none" : `opacity 0.32s ${ease}`,
          pointerEvents: mapProgress > 0.5 ? "none" : "auto",
        }}
        onPointerDown={(e) => startPress(e, false)}
        onPointerMove={movePress}
        onPointerUp={() => endPress(() => setSheetFrac(SNAP_MAP))}
        onPointerCancel={() => endPress()}
        role="button"
        aria-label="Expand map"
      >
        <HeroScene />
        <div className="absolute inset-x-0 top-[52px] flex justify-center">
          <WalkingPin className="h-[50px]" />
        </div>
        <div className="absolute inset-x-0 top-[114px]">
          <AreaStatus />
        </div>
      </div>

      {/* ═══ map-mode floating controls ═══ */}
      <div
        className="absolute left-4 top-[52px] z-30 flex flex-col items-start gap-2"
        style={{ opacity: mapProgress, transition: dragging ? "none" : `opacity 0.32s ${ease}`, pointerEvents: inMapMode ? "auto" : "none" }}
      >
        {/* live data chip — proves the pins come from the transit API */}
        <div className="flex items-center gap-1.5 rounded-full bg-white/95 py-[6px] pl-2.5 pr-3 shadow-lg shadow-black/15 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute h-full w-full animate-ping rounded-full bg-[#1E9D4D]/60" />
            <span className="relative h-2 w-2 rounded-full bg-[#1E9D4D]" />
          </span>
          <span className="text-[10px] font-bold text-[#111]">
            {nearby ? `${nearby.counts.bus} bus · ${nearby.counts.metro} metro · ${nearby.counts.railway} rail` : "Locating stops…"}
          </span>
        </div>
        {toggles.map((t) => (
          <button
            key={t.label}
            onClick={() => t.set(!t.on)}
            aria-pressed={t.on}
            className="flex items-center gap-2 rounded-full bg-[#1C1C1E]/95 py-[7px] pl-3.5 pr-2 shadow-lg shadow-black/25 backdrop-blur transition active:scale-95"
          >
            <span className="text-[11px] font-bold text-white">{t.label}</span>
            <span className={cn("relative h-[20px] w-[34px] rounded-full transition-colors", t.on ? "bg-[#0A6CFF]" : "bg-white/25")}>
              <span
                className={cn(
                  "absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow transition-all duration-200",
                  t.on ? "left-[16px]" : "left-[2px]"
                )}
              />
            </span>
          </button>
        ))}
      </div>

      <button
        aria-label="Close map"
        onClick={() => setSheetFrac(SNAP_HOME)}
        className="absolute right-4 top-[52px] z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#111] shadow-lg shadow-black/20 transition active:scale-90"
        style={{ opacity: mapProgress, transition: dragging ? "none" : `opacity 0.32s ${ease}`, pointerEvents: inMapMode ? "auto" : "none" }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <button
        aria-label="Locate me"
        onClick={() => {
          window.dispatchEvent(new Event("chennai-one:locate"));
          reportEvent("locate_me", { area: USER_AREA });
        }}
        className="absolute right-4 z-30 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-[#1A2B49] shadow-lg shadow-black/20 transition active:scale-90"
        style={{
          bottom: `calc(${sheetFrac * 100}% + 14px)`,
          opacity: mapProgress,
          transition: dragging ? "none" : `bottom 0.32s ${ease}, opacity 0.32s ${ease}, transform 0.15s`,
          pointerEvents: inMapMode ? "auto" : "none",
        }}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="6.4" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <path d="M12 1.6v3.2M12 19.2v3.2M1.6 12h3.2M19.2 12h3.2" />
        </svg>
      </button>

      {/* ═══ draggable bottom sheet ═══ */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[26px] bg-white shadow-[0_-10px_36px_rgba(17,17,17,0.12)]"
        style={{
          height: `${sheetFrac * 100}%`,
          transition: dragging ? "none" : `height 0.32s ${ease}`,
        }}
      >
        {/* grab zone: handle + status + search */}
        <div
          className="px-4 pt-2.5"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => startPress(e, !!(e.target as HTMLElement).closest("[data-search]"))}
          onPointerMove={movePress}
          onPointerUp={() => endPress()}
          onPointerCancel={() => endPress()}
        >
          {/* drag handle */}
          <div className="mx-auto mb-1.5 h-[5px] w-12 rounded-full bg-[#C7C7CC]" />

          {/* status text (map mode) */}
          <div
            className="overflow-hidden"
            style={{
              height: `${mapProgress * 50}px`,
              opacity: mapProgress,
              transition: dragging ? "none" : `height 0.32s ${ease}, opacity 0.32s ${ease}`,
            }}
          >
            <div className="pt-1">
              <AreaStatus mapMode />
            </div>
          </div>

          {/* gradient search pill */}
          <button
            type="button"
            data-search
            aria-label="Search destinations"
            onClick={(e) => {
              e.stopPropagation();
              openOverlay("search");
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className="cursor-pointer mt-1.5 flex h-11 w-full items-center justify-between rounded-full bg-[linear-gradient(90deg,#D618E8_0%,#F0143C_48%,#F25C05_100%)] px-5 text-white shadow-[0_6px_18px_rgba(240,20,60,0.35)] transition hover:brightness-105 active:scale-[0.98]"
          >
            <span className="truncate text-[15px] font-semibold">Search “Bus, Metro, Train”</span>
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" fill="currentColor" aria-hidden>
              <path d="M10 3a7 7 0 1 0 4.24 12.56l4.1 4.1a1.2 1.2 0 0 0 1.7-1.7l-4.1-4.1A7 7 0 0 0 10 3zm0 2.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2z" />
            </svg>
          </button>
        </div>

        {/* scrollable content — the mode carousel peeks out in map mode */}
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-32 pt-3", inMapMode && "overflow-hidden")}>
          {/* ── area incident-alert banner ── */}
          <AreaAlertBanner />

          {/* ── mode carousel ── */}
          <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {MODE_CARDS.map((card) => (
              <button
                key={card.id}
                onClick={() => onModeCard(card.id)}
                className="flex w-[92px] shrink-0 flex-col items-center rounded-[20px] bg-white p-2 shadow-[0_3px_12px_rgba(17,17,17,0.07)] transition active:scale-95"
              >
                <ModeArt id={card.id} />
                <p className="mt-1 text-[12.5px] font-semibold text-[#1F1F1F]">{card.label}</p>
                <p className="mt-0.5 text-[8px] font-medium text-[#6B7280]">{card.sub}</p>
              </button>
            ))}
          </div>

          {/* ── promo carousel ── */}
          <div className="mt-3 overflow-hidden rounded-[24px]">
            <div
              className="flex"
              style={{ transform: `translateX(-${promoIdx * 100}%)`, transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1)" }}
            >
              {/* slide 1 · ₹1 rupee ticket */}
              <div className="flex w-full shrink-0 items-center gap-3 bg-[#F8D84A] p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-end gap-2">
                    <span className="text-[36px] font-extrabold leading-[0.85] text-[#1A1A1A]">₹1</span>
                    <div className="pb-0.5">
                      <p className="text-[14px] font-bold leading-tight text-[#1A1A1A]">₹1 Rupee Ticket</p>
                      <p className="text-[11px] font-semibold text-[#4A3F10]">⚡ 1-Click Booking</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openOverlay("busBooking");
                      }}
                      className="rounded-full bg-[#1A5CE5] px-3.5 py-1.5 text-[10.5px] font-extrabold tracking-wide text-white shadow-sm transition active:scale-95"
                    >
                      GET TICKET
                    </button>
                    <span className="text-[10px] font-bold text-[#1A5CE5] underline underline-offset-2">Powered by CUMTA</span>
                  </div>
                </div>
                <RupeePhoneMock />
              </div>

              {/* slide 2 · live tracking */}
              <div className="flex w-full shrink-0 items-center gap-3 bg-gradient-to-r from-[#1A6FE0] to-[#3D7BF0] p-3">
                <ModeArt id="bus" />
                <div className="min-w-0 flex-1 text-white">
                  <p className="text-[15px] font-bold leading-tight">Track buses live</p>
                  <p className="mt-0.5 text-[11.5px] font-medium text-sky-100/90">Real-time arrivals on the map</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openOverlay("liveTracking");
                    }}
                    className="mt-2.5 rounded-full bg-white px-3.5 py-1.5 text-[10.5px] font-extrabold tracking-wide text-[#1A6FE0] shadow-sm transition active:scale-95"
                  >
                    Track now
                  </button>
                </div>
              </div>

              {/* slide 3 · metro qr */}
              <div className="flex w-full shrink-0 items-center gap-3 bg-[#17356B] p-3">
                <ModeArt id="metro" />
                <div className="min-w-0 flex-1 text-white">
                  <p className="text-[15px] font-bold leading-tight">Metro QR tickets</p>
                  <p className="mt-0.5 text-[11.5px] font-medium text-sky-200/85">Book & scan straight at the gates</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openOverlay("metroBooking");
                    }}
                    className="mt-2.5 rounded-full bg-white px-3.5 py-1.5 text-[10.5px] font-extrabold tracking-wide text-[#17356B] shadow-sm transition active:scale-95"
                  >
                    Book now
                  </button>
                </div>
              </div>

              {/* slide 4 · city pulse */}
              <div className="flex w-full shrink-0 items-center gap-3 bg-gradient-to-r from-[#14532D] to-[#0E8A4F] p-3">
                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300/30" />
                  <span className="absolute inset-1.5 rounded-full border-2 border-emerald-200/40" />
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-[#0E8A4F]" fill="currentColor">
                      <path d="M12 2a10 10 0 0 0-10 10 10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm0 2a8 8 0 0 1 8 8 8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8zm-1 4v5.4l4.2 2.5 1-1.7-3.2-1.9V8h-2z" />
                    </svg>
                  </span>
                </span>
                <div className="min-w-0 flex-1 text-white">
                  <p className="text-[15px] font-bold leading-tight">City Pulse</p>
                  <p className="mt-0.5 text-[11.5px] font-medium text-emerald-50/90">Live social mobility events, verified on the map</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLiveMode("pulse");
                      openOverlay("liveTracking");
                    }}
                    className="mt-2.5 rounded-full bg-white px-3.5 py-1.5 text-[10.5px] font-extrabold tracking-wide text-[#0E8A4F] shadow-sm transition active:scale-95"
                  >
                    Open pulse
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* dots */}
          <div className="mt-1.5 flex justify-center gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => setPromoIdx(i)}
                aria-label={`Promo slide ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  promoIdx === i ? "w-4 bg-[#2B2B2B]" : "w-1.5 bg-[#C9C8CE]"
                )}
              />
            ))}
          </div>

          {/* ── citizen report CTA ── */}
          <button
            onClick={() => openOverlay("reportIncident")}
            className="mt-3 flex w-full items-center gap-3 rounded-[24px] bg-gradient-to-r from-[#7C3AED] to-[#5B4FE9] p-3.5 text-left text-white shadow-[0_6px_18px_rgba(91,79,233,0.35)] transition active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="currentColor">
                <path d="M12 8V4l8 8-8 8v-4H4V8h8z" opacity="0" />
                <path d="M3 10v4h3l5 4V6L6 10H3zm13.5 2c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.5 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold leading-tight">See something? Report it</span>
              <span className="mt-0.5 block text-[10.5px] font-medium leading-snug text-indigo-100/90">
                Waterlogging, jams, breakdowns — alert commuters near you
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold tracking-wide text-[#5B4FE9] shadow-sm">
              Report
            </span>
          </button>

          {/* ── track your buses ── */}
          <div className="mb-2 mt-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[18px] font-semibold leading-tight text-[#1F1F1F]">Track your buses</h2>
              <p className="mt-1 text-[12px] leading-snug text-[#6B7280]">
                Nearby Stop:{" "}
                <span className="font-semibold text-[#111] underline underline-offset-2">{NEARBY_STOP}</span>
              </p>
            </div>
            <button
              onClick={() => openOverlay("liveTracking")}
              className="mt-1 shrink-0 rounded-full bg-[#1A6FE0] px-3.5 py-2 text-[11.5px] font-bold text-white shadow-[0_4px_12px_rgba(26,111,224,0.35)] transition active:scale-95"
            >
              Show all ›
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {NEARBY_ROUTES.map((group) => (
              <div key={group.towards} className="rounded-[24px] bg-white p-4 shadow-[0_3px_14px_rgba(17,17,17,0.06)]">
                <p className="text-[10.5px] font-bold tracking-[0.12em] text-[#8E8E93]">TOWARDS {group.towards}</p>
                <div className="mt-0.5 divide-y divide-slate-100">
                  {group.routes.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => openOverlay("busDetail")}
                      className="flex w-full items-center gap-3 py-2 text-left transition active:opacity-70"
                    >
                      <span className="rounded-[10px] bg-[#F5E9C8] px-2.5 py-1.5 text-[13px] font-extrabold text-[#3D2E10]">{r.code}</span>
                      <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#111]">{r.to}</span>
                      {r.kind === "live" ? (
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#EAF7EE] px-2 py-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute h-full w-full animate-ping rounded-full bg-[#1A6FE0]/60" />
                            <span className="relative h-2 w-2 rounded-full bg-[#1A6FE0]" />
                          </span>
                          <span className="text-[10.5px] font-extrabold tracking-wide text-[#1F9D4D]">{r.eta}</span>
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-[#F1F0F4] px-2 py-1.5 text-[10px] font-bold text-[#6B7280]">{r.time}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
