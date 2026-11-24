"use client";

import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Official Chennai One logo — CUMTA unified transport mobility mark
// Represents 'C' (Chennai) integrated with '1' (One) on the signature
// rose-coral gradient tile.
// ─────────────────────────────────────────────────────────────────────────────

export const CHENNAI_ONE_GLYPH_PATH =
  "M5405 3380 c580 -34 1091 -167 1572 -409 748 -376 1328 -1005 1622 " +
  "-1759 268 -688 299 -1424 91 -2136 -209 -715 -639 -1333 -1233 -1773 -107 -79 " +
  "-364 -240 -371 -232 -7 7 -236 469 -296 596 l-58 121 101 62 c382 234 702 586 " +
  "906 997 122 244 209 526 248 798 25 178 25 551 0 715 -91 585 -403 1128 -868 " +
  "1507 -699 569 -1716 798 -2674 601 -871 -178 -1640 -729 -1983 -1420 -29 -58 " +
  "-74 -172 -101 -254 -263 -800 -119 -1657 393 -2338 362 -481 882 -805 1526 " +
  "-950 128 -29 417 -73 425 -64 3 2 4 612 3 1355 l-3 1350 -350 -149 c-192 -81 " +
  "-359 -151 -370 -154 -18 -4 -33 29 -152 343 -73 191 -129 350 -125 354 4 4 " +
  "309 163 679 353 l672 346 253 -2 253 -3 3 -2294 c1 -1262 -2 -2299 -6 -2303 " +
  "-19 -19 -441 -31 -669 -19 -894 45 -1596 287 -2203 757 -207 160 -476 443 " +
  "-640 673 -330 464 -549 1039 -615 1616 -19 168 -19 502 0 670 86 744 410 1447 " +
  "913 1976 530 559 1238 908 2082 1028 316 45 659 59 975 41z";

export function TriangleLogo({
  className = "h-10 w-10",
  mono = false,
  showBackground = true,
}: {
  className?: string;
  mono?: boolean;
  showBackground?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className={className}
      role="img"
      aria-label="Chennai One logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="c1OfficialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ED2A2B" />
          <stop offset="35%" stopColor="#E3153A" />
          <stop offset="70%" stopColor="#E61563" />
          <stop offset="100%" stopColor="#D154D0" />
        </linearGradient>
      </defs>
      {showBackground && (
        <rect
          width="1024"
          height="1024"
          rx="224"
          fill={mono ? "#1B1F26" : "url(#c1OfficialGrad)"}
        />
      )}
      <g
        transform="translate(0, 1024) scale(0.1, -0.1)"
        fill={showBackground ? "#FFFFFF" : mono ? "#1B1F26" : "#E3153A"}
      >
        <path d={CHENNAI_ONE_GLYPH_PATH} />
      </g>
    </svg>
  );
}

/** Full boot splash shown briefly inside the phone screen on app open. */
export function Splash({ leaving }: { leaving?: boolean }) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-[80] flex flex-col items-center justify-center bg-[radial-gradient(120%_90%_at_50%_0%,#28122D_0%,#190C22_55%,#0B0710_100%)] text-white",
        leaving && "animate-[splashout_0.45s_ease_forwards]"
      )}
      aria-hidden={leaving}
    >
      <div className="animate-[splashin_0.6s_cubic-bezier(0.22,1,0.36,1)_both]">
        <TriangleLogo className="h-28 w-28 drop-shadow-[0_12px_36px_rgba(235,34,57,0.55)]" />
      </div>
      <p className="mt-5 text-[22px] font-extrabold tracking-[0.24em] text-white">CHENNAI ONE</p>
      <p className="mt-1.5 text-[11px] font-semibold tracking-[0.3em] text-rose-200/90">BUS · METRO · TRAIN</p>
      <div className="absolute bottom-9 flex items-center gap-2 text-[10px] font-medium text-slate-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
        An initiative of CUMTA · Govt. of Tamil Nadu
      </div>
    </div>
  );
}
