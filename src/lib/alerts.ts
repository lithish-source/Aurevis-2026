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
