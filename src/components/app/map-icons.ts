"use client";

import L from "leaflet";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Leaflet divIcon pin builders. Each returns an icon whose HTML mirrors
// the original SVG pin designs (walking user pin, maroon bus stop, navy metro
// square, teal railway square).

const WALK_GLYPH = `<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><circle cx="12.4" cy="4.4" r="2.1"/><path d="M12 7.2l-1.8 4.4-2.6 1.9.9 1.3 2.9-2 .5-1.2.8 2.4-2.6 3.6.4 3.4-1.5.2-.5-3.2 2.2-3 .7-2.4 2.3 1.7 3.3.1-.1 1.5-3.9-.2-2.6-2-1.2 1.5 1.3 2.1-.1 4.2-1.5.1-.3-3.9.9-1.7-1-1.7 1-1.9-.2-1.9-4.3-1.4-1.1 1.2.5 2.1-1.1 2.6-1.4 1z"/></svg>`;

const BUS_GLYPH = `<svg viewBox="0 0 24 24" width="17" height="17" fill="#fff"><path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1v2.2a1 1 0 0 1-2 0V18h-2.5v2.2a1 1 0 0 1-2 0V18H9v2.2a1 1 0 0 1-2 0V18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1 3v6h12V6H6z"/></svg>`;

const TRAIN_GLYPH = `<svg viewBox="0 0 24 24" width="15" height="15" fill="#fff"><path d="M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3l1 3h-2l-1-3h-4l-1 3H7l1-3a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 3v4h8V6H8z"/></svg>`;

/** Blue circular "walking" pin that marks the user's location. */
export function userPinIcon(): L.DivIcon {
  return L.divIcon({
    className: "c1-pin",
    iconSize: [54, 66],
    iconAnchor: [27, 62],
    html: `<div class="c1-drop" style="position:relative;width:54px;height:66px">
      <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:46px;height:46px;border-radius:50%;background:#0B67C4;border:3.5px solid #fff;box-shadow:0 4px 12px rgba(11,60,120,.45);display:flex;align-items:center;justify-content:center">${WALK_GLYPH}</div>
      <div style="position:absolute;left:50%;top:38px;transform:translateX(-50%) rotate(45deg);width:15px;height:15px;background:#0B67C4;border-radius:3px"></div>
      <div style="position:absolute;left:50%;top:56px;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;background:#0B67C4;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(11,60,120,.4)"></div>
    </div>`,
  });
}

/** Maroon rounded-square bus stop pin (active stops carry a blue badge). */
export function busStopIcon(active: boolean, size = 38): L.DivIcon {
  const badge = active
    ? `<div style="position:absolute;right:-3px;top:-3px;width:13px;height:13px;border-radius:50%;background:#1A6FE0;border:2px solid #fff"></div>`
    : "";
  return L.divIcon({
    className: "c1-pin",
    iconSize: [size + 10, size + 12],
    iconAnchor: [(size + 10) / 2, size + 8],
    html: `<div class="c1-drop" style="position:relative;width:${size + 10}px;height:${size + 12}px;opacity:${active ? 1 : 0.62}">
      <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:${size}px;height:${size}px;border-radius:${size / 4}px;background:${active ? "#2B0A14" : "#8E8E93"};border:2.5px solid #fff;box-shadow:0 4px 10px rgba(30,10,20,.35);display:flex;align-items:center;justify-content:center">${BUS_GLYPH}</div>
      <div style="position:absolute;left:50%;top:${size - 5}px;transform:translateX(-50%) rotate(45deg);width:12px;height:12px;background:${active ? "#2B0A14" : "#8E8E93"};border-radius:3px"></div>
      ${badge}
    </div>`,
  });
}

/** Navy square metro station pin with a white "M". */
export function metroIcon(size = 34): L.DivIcon {
  return L.divIcon({
    className: "c1-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div class="c1-drop" style="width:${size}px;height:${size}px;border-radius:${size / 5}px;background:#17356B;border:2.5px solid #fff;box-shadow:0 4px 10px rgba(10,25,60,.4);display:flex;align-items:center;justify-content:center">
      <span style="color:#fff;font-size:${size * 0.52}px;font-weight:900;font-family:system-ui,sans-serif;line-height:1">M</span>
    </div>`,
  });
}

/** Teal square railway station pin. */
export function railwayIcon(size = 32): L.DivIcon {
  return L.divIcon({
    className: "c1-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div class="c1-drop" style="width:${size}px;height:${size}px;border-radius:${size / 5}px;background:#0E4B4E;border:2.5px solid #fff;box-shadow:0 4px 10px rgba(5,35,38,.4);display:flex;align-items:center;justify-content:center">${TRAIN_GLYPH}</div>`,
  });
}

/** Blue circular live vehicle marker (bus or metro train). */
export function vehicleIcon(vehicle: "bus" | "metro"): L.DivIcon {
  const glyph =
    vehicle === "bus"
      ? BUS_GLYPH
      : `<svg viewBox="0 0 24 24" width="17" height="17" fill="#fff"><path d="M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3l1 3h-2l-1-3h-4l-1 3H7l1-3a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 3v4h8V6H8z"/></svg>`;
  return L.divIcon({
    className: "c1-pin",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<div style="position:relative;width:40px;height:40px">
      <span class="c1-ping" style="position:absolute;inset:0;border-radius:50%;background:rgba(26,86,219,.35)"></span>
      <div style="position:absolute;inset:4px;border-radius:50%;background:#1A56DB;border:3px solid #fff;box-shadow:0 3px 10px rgba(16,50,140,.5);display:flex;align-items:center;justify-content:center">${glyph}</div>
    </div>`,
  });
}

/** Red ETA bubble anchored above a stop. */
export function etaBubbleIcon(text: string): L.DivIcon {
  return L.divIcon({
    className: "c1-pin",
    iconSize: [64, 34],
    iconAnchor: [32, 6],
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <span style="display:flex;align-items:center;gap:4px;white-space:nowrap;border-radius:999px;background:#E53935;padding:3px 9px;font-size:11px;font-weight:700;color:#fff;box-shadow:0 3px 8px rgba(0,0,0,.25);font-family:system-ui,sans-serif">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>${text}
      </span>
      <span style="width:8px;height:8px;background:#E53935;transform:rotate(45deg) translateY(-4px)"></span>
    </div>`,
  });
}

/** Small blue user-location dot (route maps). */
export function userDotIcon(): L.DivIcon {
  return L.divIcon({
    className: "c1-pin",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div style="position:relative;width:20px;height:20px">
      <span class="c1-ping" style="position:absolute;inset:0;border-radius:50%;background:rgba(26,111,224,.4)"></span>
      <span style="position:absolute;inset:2.5px;border-radius:50%;background:#0B67C4;border:3px solid #fff;box-shadow:0 1px 5px rgba(11,60,120,.5)"></span>
    </div>`,
  });
}

/** Social mobility-event pin. Colour encodes verification status
 *  (verified emerald / unverified amber / flagged rose), ring pulse for
 *  high+ severity, and the glyph hints at the event family. */
export function socialEventIcon(
  verification: string | null | undefined,
  severity: string | null | undefined,
  glyph: "drop" | "crash" | "jam" | "wrench" | "alert" = "alert",
  size = 34,
): L.DivIcon {
  const color = verification === "verified" ? "#0E8A4F" : verification === "flagged" ? "#D63A4A" : "#C77E12";
  const ring = verification === "verified" ? "#5BD6A0" : verification === "flagged" ? "#F0A2AC" : "#F2D48A";
  const pulse = severity === "high" || severity === "critical";
  const glyphs: Record<string, string> = {
    drop: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M12 2.7c3.6 4.3 6 7.6 6 10.6a6 6 0 1 1-12 0c0-3 2.4-6.3 6-10.6z"/></svg>`,
    crash: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M5 3h14a2 2 0 0 1 2 2v9l-2.4-2.4-2 2L14 11l-2 2-2-2-2 2-2-2L3 13V5a2 2 0 0 1 2-2zm1 3v3h5V6H6zm8 0v3h4V6h-4z" transform="rotate(45 12 12)"/></svg>`,
    jam: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1v2.2a1 1 0 0 1-2 0V18h-2.5v2.2a1 1 0 0 1-2 0V18H9v2.2a1 1 0 0 1-2 0V18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1 3v6h12V6H6z"/></svg>`,
    wrench: `<svg viewBox="0 0 24 24" width="15" height="15" fill="#fff"><path d="M21.7 18.3l-6.1-6.1a5.5 5.5 0 0 0-7-7l3 3-2 2-3-3a5.5 5.5 0 0 0 7 7l6.1 6.1a1.4 1.4 0 0 0 2-2z"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" width="15" height="15" fill="#fff"><path d="M12 2l9.5 17H2.5L12 2zm-1 6v5h2V8h-2zm0 7v2h2v-2h-2z"/></svg>`,
  };
  return L.divIcon({
    className: "c1-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      ${pulse ? `<span class="c1-ping" style="position:absolute;inset:-6px;border-radius:50%;background:${ring}66"></span>` : ""}
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 3px 10px rgba(20,20,20,.35);display:flex;align-items:center;justify-content:center">
        ${glyphs[glyph]}
      </div>
      ${verification === "verified" ? `<div style="position:absolute;right:-4px;bottom:-4px;width:13px;height:13px;border-radius:50%;background:#fff;border:2px solid ${color};display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="8" height="8" fill="${color}"><path d="M9.5 16.2L5.3 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z"/></svg></div>` : ""}
    </div>`,
  });
}
