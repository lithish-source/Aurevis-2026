// ─────────────────────────────────────────────────────────────────────────────
// Shared citizen-alert types (client + server safe — no server-only imports).

export type AdvisoryMetro = { name: string; km: number };

export type Advisory = {
  headline: string;
  busNote: string;
  metroNote: string;
  extra: string;
  metro: AdvisoryMetro[];
  metroAvailable: boolean;
};

export type CitizenAlert = {
  id: string;
  reportId: string | null;
  kind: "incident" | "escalation" | "cleared";
  areaLabel: string;
  lat: number;
  lon: number;
  radiusKm: number;
  headline: string;
  body: string;
  createdAt: string;
  read: boolean;
  meta?: {
    eventType?: string;
    severity?: string;
    advisory?: Advisory;
  } | null;
};

export const ALERT_EVENT_META: Record<string, { label: string; emoji: string }> = {
  congestion: { label: "Heavy traffic", emoji: "🚗" },
  accident: { label: "Road accident", emoji: "💥" },
  flood: { label: "Waterlogging", emoji: "🌧" },
  transit_disruption: { label: "Transit disruption", emoji: "🚇" },
  road_closure: { label: "Road closure", emoji: "🚧" },
  infrastructure: { label: "Infrastructure fault", emoji: "🔧" },
  protest: { label: "Protest", emoji: "📣" },
  hazard: { label: "Hazard", emoji: "⚠️" },
  other: { label: "Incident", emoji: "📍" },
};

export const ALERT_SEV_COLOR: Record<string, string> = {
  low: "#64748B",
  medium: "#C77E12",
  high: "#EA580C",
  critical: "#DC2626",
};

/** Geo-targeting: how far from the incident each severity notifies (km).
 *  Shared by the server (notification fan-out) and the client ("why didn't I
 *  get this one?" labels). Keep in sync with README. */
export const SEVERITY_RADIUS_KM: Record<string, number> = {
  low: 3,
  medium: 6,
  high: 10,
  critical: 14,
};

/** Haversine distance in km — client-safe twin of the gazetteer helper. */
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
