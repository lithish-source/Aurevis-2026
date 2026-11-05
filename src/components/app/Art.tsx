"use client";

import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Original inline SVG artwork used across the app. All drawn from scratch.

/** Deterministic QR-style pattern (decorative, not a real code). */
export function QrPattern({ seed = 7, size = 180, className = "" }: { seed?: number; size?: number; className?: string }) {
  const n = 21;
  const cell = size / n;
  // simple LCG for deterministic pattern
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const cells: React.ReactNode[] = [];
  const finderBoxes = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];
  const inFinder = (r: number, c: number) =>
    finderBoxes.some(([r0, c0]) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7);
  const finderSolid = (r: number, c: number) => {
    for (const [r0, c0] of finderBoxes) {
      if (r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7) {
        const lr = r - r0;
        const lc = c - c0;
        const ring = Math.max(Math.abs(lr - 3), Math.abs(lc - 3));
        if (ring === 3 || ring <= 1) return true;
      }
    }
    return false;
  };
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const on = inFinder(r, c) ? finderSolid(r, c) : rand() > 0.52;
      if (on) {
        cells.push(
          <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} rx={cell * 0.22} fill="#111" />
        );
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} role="img" aria-label="Ticket QR code">
      <rect width={size} height={size} fill="#fff" />
      {cells}
    </svg>
  );
}

/** Hands holding a phone with an SOS button + green shield (safety promo). */
export function SosArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 150" className={className} role="img" aria-label="Safety SOS illustration">
      <g stroke="#fff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round">
        <line x1="10" y1="34" x2="24" y2="34" />
        <line x1="14" y1="48" x2="26" y2="48" />
        <line x1="10" y1="62" x2="22" y2="62" />
      </g>
      <g transform="translate(96 12)">
        <path d="M22 2 L40 9 V24 C40 36 32 44 22 47 C12 44 4 36 4 24 V9 Z" fill="#1E9E5A" />
        <path d="M14 24 l6 6 l12 -13" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <rect x="34" y="26" width="62" height="104" rx="12" fill="#20242B" />
      <rect x="38.5" y="32" width="53" height="92" rx="8" fill="#F7F8FA" />
      <rect x="57" y="34.5" width="16" height="4" rx="2" fill="#20242B" />
      <text x="65" y="62" textAnchor="middle" fontSize="9" fontWeight="700" fill="#7A808C" letterSpacing="1">EMERGENCY</text>
      <circle cx="65" cy="86" r="17" fill="#E53935" />
      <circle cx="65" cy="86" r="17" fill="none" stroke="#F8B3B0" strokeWidth="3" strokeOpacity="0.7" />
      <text x="65" y="90.5" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#fff" letterSpacing="0.5">SOS</text>
      <rect x="46" y="112" width="38" height="6" rx="3" fill="#E3E6EB" />
      <g fill="#B0785A">
        <path d="M30 118 q6 14 22 16 l2 -8 q-12 -2 -16 -12 z" />
        <path d="M100 118 q-6 14 -22 16 l-2 -8 q12 -2 16 -12 z" />
      </g>
    </svg>
  );
}

/** Flat yellow bus illustration. */
export function BusArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 170 110" className={className} role="img" aria-label="Bus illustration">
      <rect x="18" y="10" width="134" height="76" rx="14" fill="#F6B733" />
      <rect x="18" y="10" width="134" height="20" rx="14" fill="#FCD26A" />
      <rect x="26" y="22" width="34" height="22" rx="5" fill="#DFF1FB" />
      <rect x="68" y="22" width="34" height="22" rx="5" fill="#DFF1FB" />
      <rect x="110" y="22" width="34" height="22" rx="5" fill="#DFF1FB" />
      <rect x="26" y="52" width="118" height="7" rx="3.5" fill="#E09B22" />
      <circle cx="24" cy="72" r="5" fill="#fff" />
      <circle cx="146" cy="72" r="5" fill="#fff" />
      <rect x="60" y="56" width="34" height="10" rx="5" fill="#fff" />
      <text x="77" y="64.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="#E53935">578</text>
      <g fill="#2B2F36">
        <circle cx="52" cy="88" r="11" />
        <circle cx="118" cy="88" r="11" />
      </g>
      <g fill="#D9DDE3">
        <circle cx="52" cy="88" r="4.5" />
        <circle cx="118" cy="88" r="4.5" />
      </g>
    </svg>
  );
}

/** QR ticket art for the third promo card. */
export function QrArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 150" className={className} role="img" aria-label="QR ticket illustration">
      <rect x="18" y="18" width="114" height="114" rx="14" fill="#fff" stroke="#E7C689" strokeWidth="3" />
      <g fill="#20242B">
        <rect x="34" y="34" width="22" height="22" rx="4" />
        <rect x="94" y="34" width="22" height="22" rx="4" />
        <rect x="34" y="94" width="22" height="22" rx="4" />
        <rect x="66" y="42" width="10" height="10" rx="2" />
        <rect x="84" y="60" width="10" height="10" rx="2" />
        <rect x="42" y="70" width="10" height="10" rx="2" />
        <rect x="66" y="70" width="10" height="10" rx="2" />
        <rect x="66" y="94" width="10" height="10" rx="2" />
        <rect x="86" y="94" width="10" height="10" rx="2" />
        <rect x="98" y="72" width="10" height="10" rx="2" />
        <rect x="98" y="106" width="10" height="10" rx="2" />
        <rect x="34" y="58" width="10" height="10" rx="2" />
      </g>
      <g transform="translate(99 99)">
        <circle r="17" fill="#1E9E5A" />
        <path d="M-7 0 l5 5 l10 -11" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** White metro car on a track (timetable sheet). */
export function MetroTrainArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 96" className={className} role="img" aria-label="Metro train illustration">
      <rect x="0" y="76" width="340" height="5" fill="#C9CED6" />
      <g fill="#AEB4BE">
        {Array.from({ length: 18 }).map((_, i) => (
          <rect key={i} x={i * 20 + 4} y="81" width="10" height="7" rx="1.5" />
        ))}
      </g>
      <g stroke="#8B929C" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M150 18 L178 8" />
        <path d="M206 18 L178 8" />
        <path d="M170 18 h16" />
      </g>
      <rect x="86" y="16" width="168" height="58" rx="16" fill="#F4F6F8" stroke="#D9DEE5" strokeWidth="2" />
      <rect x="86" y="16" width="168" height="14" rx="14" fill="#3B67AF" />
      <rect x="150" y="14" width="40" height="7" rx="3.5" fill="#3B67AF" />
      {[104, 140, 176, 212].map((x) => (
        <rect key={x} x={x} y="36" width="26" height="20" rx="5" fill="#243B55" />
      ))}
      <circle cx="98" cy="66" r="4" fill="#F6B733" />
      <circle cx="242" cy="66" r="4" fill="#F6B733" />
      <g fill="#2B2F36">
        <circle cx="126" cy="74" r="8" />
        <circle cx="214" cy="74" r="8" />
      </g>
    </svg>
  );
}

// ─── Landmark art for Explore cards (stylized, original) ─────────────────────

export function FortArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Fort illustration">
      <rect width="200" height="120" fill="#F3E7D3" />
      <circle cx="168" cy="24" r="13" fill="#FCD26A" />
      <rect x="0" y="96" width="200" height="24" fill="#D9C4A5" />
      <g fill="#EFE3CB">
        <rect x="24" y="52" width="152" height="44" />
        <rect x="24" y="44" width="152" height="10" />
        {Array.from({ length: 9 }).map((_, i) => (
          <rect key={i} x={24 + i * 19} y="38" width="9" height="8" />
        ))}
      </g>
      <g fill="#E5D9BE">
        <rect x="86" y="60" width="28" height="36" rx="13" />
        <rect x="52" y="66" width="18" height="30" rx="8" />
        <rect x="130" y="66" width="18" height="30" rx="8" />
      </g>
      <g stroke="#F5A623" strokeWidth="3">
        <rect x="82" y="20" width="8" height="18" />
        <path d="M86 20 v-6" />
        <circle cx="86" cy="12" r="3" fill="#E53935" />
      </g>
      <path d="M0 96 h200" stroke="#C9B694" strokeWidth="2" />
    </svg>
  );
}

export function MuseumArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Museum illustration">
      <rect width="200" height="120" fill="#FBEDE6" />
      <rect x="0" y="98" width="200" height="22" fill="#E8D3C8" />
      <rect x="30" y="52" width="140" height="46" fill="#D96C4F" />
      <rect x="30" y="42" width="140" height="12" fill="#C05A40" />
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x={34 + i * 20} y="34" width="12" height="10" fill="#D96C4F" />
      ))}
      <g fill="#F9E3D8">
        {[44, 74, 104, 134].map((x) => (
          <rect key={x} x={x} y="64" width="16" height="34" rx="7" />
        ))}
      </g>
      <circle cx="100" cy="24" r="12" fill="#F5A623" />
      <path d="M100 12 l3.5 7 h-7 z" fill="#D96C4F" />
    </svg>
  );
}

export function ParkArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Park illustration">
      <rect width="200" height="120" fill="#E8F3E2" />
      <circle cx="170" cy="22" r="12" fill="#FCD26A" />
      <rect x="0" y="100" width="200" height="20" fill="#BFE0AF" />
      <path d="M0 78 q30 -12 60 0 t60 0 t80 -6 v22 H0 z" fill="#A8D494" />
      <g>
        <rect x="58" y="66" width="7" height="34" rx="3" fill="#8B6742" />
        <circle cx="61" cy="54" r="19" fill="#3E9E5A" />
        <circle cx="48" cy="62" r="11" fill="#57B36B" />
        <circle cx="75" cy="62" r="11" fill="#57B36B" />
      </g>
      <g>
        <rect x="126" y="74" width="6" height="26" rx="3" fill="#8B6742" />
        <circle cx="129" cy="64" r="14" fill="#3E9E5A" />
      </g>
      <g stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M12 104 h42" />
        <path d="M92 104 h96" />
      </g>
    </svg>
  );
}

export function BeachArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Beach illustration">
      <rect width="200" height="70" fill="#BDE3F5" />
      <circle cx="34" cy="26" r="13" fill="#FCD26A" />
      <path d="M0 62 q25 -10 50 0 t50 0 t50 0 t50 0 v10 H0 z" fill="#8ED0F0" />
      <path d="M0 70 h200 v18 H0 z" fill="#F2E1C0" />
      <rect x="0" y="88" width="200" height="32" fill="#E8D2A8" />
      <g transform="translate(140 40)">
        <rect x="-2" y="0" width="4" height="34" fill="#8B6742" />
        <path d="M-2 2 L-26 34 H-2 z" fill="#F26B5B" />
        <path d="M2 6 L26 34 H2 z" fill="#F26B5B" />
      </g>
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round">
        <path d="M20 74 h18" />
        <path d="M60 80 h14" />
        <path d="M96 75 h20" />
      </g>
    </svg>
  );
}

export function TempleArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Temple illustration">
      <rect width="200" height="120" fill="#FDF3E0" />
      <circle cx="172" cy="22" r="12" fill="#FCD26A" />
      <rect x="0" y="102" width="200" height="18" fill="#EAD9BC" />
      <path d="M0 102 h200" stroke="#D9C49A" strokeWidth="2" />
      <g fill="#C05A40">
        <rect x="52" y="72" width="96" height="30" />
        <path d="M52 72 h96 l-8 -18 h-80 z" />
        <path d="M70 54 h60 l-6 -16 h-48 z" />
        <path d="M84 38 h32 L100 20 z" fill="#D96C4F" />
      </g>
      <g fill="#F5A623">
        <circle cx="100" cy="16" r="4" />
        <rect x="96" y="8" width="8" height="8" rx="2" />
      </g>
      <g fill="#7A3FA0">
        <rect x="70" y="30" width="8" height="8" rx="2" />
        <rect x="122" y="30" width="8" height="8" rx="2" />
        <rect x="56" y="46" width="8" height="8" rx="2" />
        <rect x="136" y="46" width="8" height="8" rx="2" />
      </g>
      <path d="M88 84 h24 v18 H88 z" fill="#F9E3D8" />
    </svg>
  );
}

export function VivekArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Cathedral illustration">
      <rect width="200" height="120" fill="#EAF0F6" />
      <circle cx="30" cy="24" r="12" fill="#FCD26A" />
      <rect x="0" y="100" width="200" height="20" fill="#D5DEE8" />
      <g fill="#E8E0D2">
        <rect x="60" y="46" width="80" height="54" />
        <path d="M60 46 q40 -34 80 0 z" />
      </g>
      <path d="M100 6 L102 26 h-4 z" fill="#8B929C" />
      <path d="M96 10 q8 4 0 10 q-8 -4 0 -10" fill="#F26B5B" />
      <g fill="#B9CFE3">
        <rect x="70" y="62" width="12" height="38" rx="6" />
        <rect x="118" y="62" width="12" height="38" rx="6" />
        <path d="M92 78 a8 8 0 0 1 16 0 v22 H92 z" />
      </g>
      <path d="M88 56 h24" stroke="#C9B694" strokeWidth="2" />
    </svg>
  );
}

export function PlanetArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Planetarium illustration">
      <rect width="200" height="120" fill="#243B55" />
      <g fill="#fff" opacity="0.85">
        <circle cx="24" cy="18" r="1.6" />
        <circle cx="52" cy="30" r="1.2" />
        <circle cx="180" cy="16" r="1.8" />
        <circle cx="160" cy="44" r="1.2" />
        <circle cx="40" cy="90" r="1.4" />
        <circle cx="120" cy="14" r="1.2" />
      </g>
      <circle cx="100" cy="52" r="26" fill="#E8B04B" />
      <ellipse cx="100" cy="52" rx="46" ry="12" fill="none" stroke="#F5D488" strokeWidth="4" transform="rotate(-16 100 52)" />
      <rect x="0" y="98" width="200" height="22" fill="#1B2D42" />
      <g fill="#DCE6F2">
        <rect x="78" y="88" width="44" height="12" rx="4" />
        <rect x="86" y="94" width="28" height="6" rx="3" fill="#8FA7C4" />
      </g>
    </svg>
  );
}

export const PLACE_ART: Record<string, (p: { className?: string }) => React.JSX.Element> = {
  fort: FortArt,
  museum: MuseumArt,
  park: ParkArt,
  beach: BeachArt,
  temple: TempleArt,
  vivek: VivekArt,
  planet: PlanetArt,
};

/** Location pin icon. */
export function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a7 7 0 0 0 -7 7c0 5.25 7 13 7 13s7 -7.75 7 -13a7 7 0 0 0 -7 -7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}
