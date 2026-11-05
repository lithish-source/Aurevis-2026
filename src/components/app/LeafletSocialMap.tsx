"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Tooltip, useMap, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { SmartTileLayer } from "@/components/app/SmartTileLayer";
import { socialEventIcon } from "@/components/app/map-icons";

// ─────────────────────────────────────────────────────────────────────────────
// City Pulse map — spatial visualisation of classified social mobility events.
// Pin colour = verification status (emerald verified / amber unverified /
// rose flagged), pulse ring = high or critical severity, circle halo =
// corroboration cluster size.

export type PulseMapEvent = {
  id: string;
  source: string;
  handle?: string | null;
  text: string;
  eventType: string | null;
  severity: string | null;
  sentiment: string | null;
  placeLabel: string | null;
  lat: number | null;
  lon: number | null;
  trustScore: number | null;
  verification: string | null;
  corroborates: number;
  postedAt: string;
};

const TYPE_GLYPH: Record<string, "drop" | "crash" | "jam" | "wrench" | "alert"> = {
  flood: "drop",
  accident: "crash",
  congestion: "jam",
  transit_disruption: "jam",
  road_closure: "jam",
  infrastructure: "wrench",
  protest: "alert",
  hazard: "alert",
  other: "alert",
};

function FitBounds({ events }: { events: PulseMapEvent[] }) {
  const map = useMap();
  const key = events.map((e) => e.id).join(",");
  useEffect(() => {
    const pts = events.filter((e) => e.lat != null && e.lon != null);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView([pts[0].lat!, pts[0].lon!], 14, { animate: true });
      return;
    }
    const lats = pts.map((p) => p.lat!);
    const lons = pts.map((p) => p.lon!);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ],
      { padding: [36, 36], maxZoom: 14, animate: true },
    );
     
  }, [key, map]);
  return null;
}

const VERIF_COLOR: Record<string, string> = {
  verified: "#0E8A4F",
  unverified: "#C77E12",
  flagged: "#D63A4A",
};

export function LeafletSocialMap({
  className = "",
  events,
  onSelect,
}: {
  className?: string;
  events: PulseMapEvent[];
  onSelect?: (e: PulseMapEvent) => void;
}) {
  const placed = useMemo(
    () => events.filter((e) => e.lat != null && e.lon != null) as Array<PulseMapEvent & { lat: number; lon: number }>,
    [events],
  );

  return (
    <div className={cn("relative h-full w-full", className)} aria-label="City pulse events map">
      <MapContainer
        center={[13.045, 80.22]}
        zoom={12}
        minZoom={10}
        maxZoom={18}
        zoomControl={false}
        attributionControl
        preferCanvas
        style={{ height: "100%", width: "100%" }}
      >
        <SmartTileLayer />
        <FitBounds events={events} />

        {placed.map((e) => (
          <span key={e.id}>
            {e.corroborates > 0 && (
              <Circle
                center={[e.lat, e.lon]}
                radius={Math.min(900, 320 + e.corroborates * 180)}
                pathOptions={{
                  color: VERIF_COLOR[e.verification ?? "unverified"] ?? "#C77E12",
                  weight: 1,
                  opacity: 0.5,
                  fillOpacity: 0.08,
                }}
                interactive={false}
              />
            )}
            <Marker
              position={[e.lat, e.lon]}
              icon={socialEventIcon(e.verification, e.severity, TYPE_GLYPH[e.eventType ?? "other"] ?? "alert")}
              eventHandlers={{ click: () => onSelect?.(e) }}
              zIndexOffset={e.verification === "verified" ? 300 : e.verification === "flagged" ? 100 : 200}
            >
              <Tooltip direction="top" offset={[0, -20]} opacity={1}>
                <span className="block max-w-[220px]">
                  <span className="block text-[11px] font-bold">
                    {e.placeLabel ?? "Chennai"} · {e.eventType?.replace(/_/g, " ") ?? "event"}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug opacity-80">
                    {e.text.slice(0, 90)}
                    {e.text.length > 90 ? "…" : ""}
                  </span>
                  <span className="mt-0.5 block text-[9.5px] font-semibold opacity-70">
                    {e.verification} · trust {Math.round((e.trustScore ?? 0) * 100)}%
                    {e.corroborates > 0 ? ` · ${e.corroborates + 1} reports` : ""}
                  </span>
                </span>
              </Tooltip>
            </Marker>
          </span>
        ))}
      </MapContainer>
    </div>
  );
}

export default LeafletSocialMap;
