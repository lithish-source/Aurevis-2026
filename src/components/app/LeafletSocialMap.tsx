"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Tooltip, Popup, useMap, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { SmartTileLayer } from "@/components/app/SmartTileLayer";
import { socialEventIcon } from "@/components/app/map-icons";

// ─────────────────────────────────────────────────────────────────────────────
// Spatial Visualisation Engine for Classified Mobility Events.
// Visualises:
//   • Issue type glyphs (accident, congestion, flood, transit disruption, etc.)
//   • Extracted exact location name + GPS latitude/longitude coordinates
//   • Extracted time reference (e.g. "20 mins ago", "10:30 AM") + ISO timestamp
//   • Classified Severity: critical (pulsing red halo), high (orange halo), medium (amber), low (blue)
//   • Classified Sentiment: negative 🔴, neutral 🟡, positive 🟢
//   • Corroboration Buffers / Halos representing spatial disruption impact radius

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
  timeRef?: string | null;
  title?: string | null;
  photo?: string | null;
  mismatchReason?: string | null;
};

export const TYPE_GLYPH: Record<string, "drop" | "crash" | "jam" | "wrench" | "alert"> = {
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

export const TYPE_LABEL: Record<string, { label: string; icon: string; bg: string }> = {
  flood: { label: "Waterlogging / Flood", icon: "🌧️", bg: "bg-blue-900/60 text-blue-200 border-blue-700/60" },
  accident: { label: "Road Collision", icon: "💥", bg: "bg-rose-900/60 text-rose-200 border-rose-700/60" },
  congestion: { label: "Traffic Congestion", icon: "🚗", bg: "bg-amber-900/60 text-amber-200 border-amber-700/60" },
  transit_disruption: { label: "Transit Disruption", icon: "🚇", bg: "bg-purple-900/60 text-purple-200 border-purple-700/60" },
  road_closure: { label: "Road Closure", icon: "🚧", bg: "bg-orange-900/60 text-orange-200 border-orange-700/60" },
  infrastructure: { label: "Infrastructure / Pothole", icon: "🔧", bg: "bg-slate-800 text-slate-200 border-slate-700" },
  hazard: { label: "Road Hazard", icon: "⚠️", bg: "bg-yellow-900/60 text-yellow-200 border-yellow-700/60" },
  protest: { label: "Public Demonstration", icon: "📢", bg: "bg-red-900/60 text-red-200 border-red-700/60" },
  other: { label: "Mobility Event", icon: "📍", bg: "bg-slate-800 text-slate-300 border-slate-700" },
};

const SEVERITY_COLOR: Record<string, { ring: string; fill: string; radius: number }> = {
  critical: { ring: "#EF4444", fill: "#EF4444", radius: 2200 },
  high: { ring: "#F97316", fill: "#F97316", radius: 1400 },
  medium: { ring: "#F59E0B", fill: "#F59E0B", radius: 850 },
  low: { ring: "#3B82F6", fill: "#3B82F6", radius: 450 },
};

function FitBounds({ events, selectedId }: { events: PulseMapEvent[]; selectedId?: string | null }) {
  const map = useMap();
  const key = events.map((e) => e.id).join(",");

  useEffect(() => {
    if (selectedId) {
      const target = events.find((e) => e.id === selectedId);
      if (target?.lat != null && target?.lon != null) {
        map.setView([target.lat, target.lon], 15, { animate: true });
        return;
      }
    }

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
      { padding: [40, 40], maxZoom: 14, animate: true },
    );
  }, [key, selectedId, map]);

  return null;
}

export function LeafletSocialMap({
  className = "",
  events,
  onSelect,
  showControls = true,
  selectedId = null,
}: {
  className?: string;
  events: PulseMapEvent[];
  onSelect?: (e: PulseMapEvent) => void;
  showControls?: boolean;
  selectedId?: string | null;
}) {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSev, setFilterSev] = useState<string>("all");
  const [filterSent, setFilterSent] = useState<string>("all");
  const [showHalos, setShowHalos] = useState<boolean>(true);

  // Filter events based on interactive spatial controls
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterType !== "all" && e.eventType !== filterType) return false;
      if (filterSev !== "all" && e.severity !== filterSev) return false;
      if (filterSent !== "all" && e.sentiment !== filterSent) return false;
      return true;
    });
  }, [events, filterType, filterSev, filterSent]);

  const placed = useMemo(
    () =>
      filteredEvents.filter((e) => e.lat != null && e.lon != null) as Array<
        PulseMapEvent & { lat: number; lon: number }
      >,
    [filteredEvents],
  );

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)} aria-label="Spatial mobility events map">
      {/* ── Interactive Map Controls Toolbar ── */}
      {showControls && (
        <div className="absolute left-2.5 right-2.5 top-2.5 z-[500] flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-[#0B0F19]/90 px-3 py-2 shadow-xl backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-extrabold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Spatially Filter:
            </span>

            {/* Issue Type selector */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-slate-200 outline-none hover:border-slate-500 focus:border-blue-500"
            >
              <option value="all">All Issues ({events.length})</option>
              <option value="congestion">🚗 Congestion</option>
              <option value="accident">💥 Accident</option>
              <option value="flood">🌧️ Flood / Waterlogging</option>
              <option value="transit_disruption">🚇 Transit Disruption</option>
              <option value="road_closure">🚧 Road Closure</option>
              <option value="infrastructure">🔧 Infrastructure</option>
              <option value="hazard">⚠️ Hazard</option>
            </select>

            {/* Severity selector */}
            <select
              value={filterSev}
              onChange={(e) => setFilterSev(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-slate-200 outline-none hover:border-slate-500 focus:border-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">🔴 Critical</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🔵 Low</option>
            </select>

            {/* Sentiment selector */}
            <select
              value={filterSent}
              onChange={(e) => setFilterSent(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-slate-200 outline-none hover:border-slate-500 focus:border-blue-500"
            >
              <option value="all">All Sentiments</option>
              <option value="negative">😡 Negative</option>
              <option value="neutral">😐 Neutral</option>
              <option value="positive">😊 Positive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHalos(!showHalos)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10.5px] font-bold transition-colors",
                showHalos
                  ? "border-blue-500/60 bg-blue-950/70 text-blue-300 shadow-sm"
                  : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: showHalos ? "#38BDF8" : "#64748B" }} />
              Impact Halos
            </button>
            <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-slate-300">
              {placed.length} visible
            </span>
          </div>
        </div>
      )}

      {/* ── Leaflet Interactive Map ── */}
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
        <FitBounds events={filteredEvents} selectedId={selectedId} />

        {placed.map((e) => {
          const sevInfo = SEVERITY_COLOR[e.severity ?? "medium"] ?? SEVERITY_COLOR.medium;
          const typeInfo = TYPE_LABEL[e.eventType ?? "other"] ?? TYPE_LABEL.other;
          const radiusM = Math.min(3200, sevInfo.radius + e.corroborates * 180);
          const isSelected = selectedId === e.id;

          return (
            <span key={e.id}>
              {/* Spatial impact radius buffer halo */}
              {showHalos && (
                <Circle
                  center={[e.lat, e.lon]}
                  radius={radiusM}
                  pathOptions={{
                    color: sevInfo.ring,
                    fillColor: sevInfo.fill,
                    weight: isSelected ? 2.5 : 1.2,
                    opacity: isSelected ? 0.9 : 0.6,
                    fillOpacity: isSelected ? 0.18 : 0.08,
                    dashArray: e.verification === "verified" ? undefined : "4, 6",
                  }}
                  interactive={false}
                />
              )}

              {/* Spatial Pin Marker */}
              <Marker
                position={[e.lat, e.lon]}
                icon={socialEventIcon(
                  e.verification,
                  e.severity,
                  TYPE_GLYPH[e.eventType ?? "other"] ?? "alert",
                  isSelected ? 42 : 34,
                  e.sentiment,
                )}
                eventHandlers={{
                  click: () => onSelect?.(e),
                }}
                zIndexOffset={isSelected ? 600 : e.verification === "verified" ? 400 : 200}
              >
                {/* Instant Glance Tooltip */}
                <Tooltip direction="top" offset={[0, -20]} opacity={1}>
                  <div className="min-w-[210px] max-w-[260px] p-0.5 font-sans">
                    <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-200">
                      <span className="flex items-center gap-1 text-[11px] font-black text-slate-900">
                        <span>{typeInfo.icon}</span>
                        <span>{e.placeLabel ?? "Chennai"}</span>
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wide",
                          e.severity === "critical"
                            ? "bg-red-100 text-red-700"
                            : e.severity === "high"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {e.severity ?? "med"}
                      </span>
                    </div>

                    <div className="mt-1 text-[10px] leading-snug text-slate-700 font-medium line-clamp-2">
                      {e.text}
                    </div>

                    {/* Spatial Coordinates & Time Metadata */}
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-100 text-[9px] text-slate-500 font-mono">
                      <span>
                        📍 {e.lat.toFixed(4)}°, {e.lon.toFixed(4)}°
                      </span>
                      <span>
                        {e.sentiment === "negative" ? "🔴 Neg" : e.sentiment === "positive" ? "🟢 Pos" : "🟡 Neu"}
                      </span>
                    </div>
                  </div>
                </Tooltip>

                {/* Rich Inspection Popup on Click */}
                <Popup className="c1-leaflet-popup">
                  <div className="min-w-[240px] max-w-[280px] text-slate-900 font-sans p-1">
                    <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{typeInfo.icon}</span>
                        <div>
                          <p className="text-[12px] font-extrabold leading-tight text-slate-900">
                            {typeInfo.label}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-500">
                            {e.placeLabel ?? "Chennai Region"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="my-2 space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        <span className={cn("rounded-md border px-2 py-0.5 text-[9.5px] font-black uppercase", typeInfo.bg)}>
                          {e.eventType?.replace(/_/g, " ")}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[9.5px] font-black uppercase text-white",
                            e.severity === "critical"
                              ? "bg-red-600"
                              : e.severity === "high"
                                ? "bg-orange-600"
                                : "bg-amber-600",
                          )}
                        >
                          Severity: {e.severity}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[9.5px] font-black uppercase",
                            e.sentiment === "negative"
                              ? "bg-red-100 text-red-800"
                              : e.sentiment === "positive"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-700",
                          )}
                        >
                          Sentiment: {e.sentiment ?? "neutral"}
                        </span>
                      </div>

                      <p className="text-[11px] leading-relaxed text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {e.text}
                      </p>

                      <div className="rounded-lg bg-slate-100/90 p-2 text-[10px] space-y-1 font-mono text-slate-600">
                        <p className="flex justify-between">
                          <span className="font-semibold text-slate-500">GPS Coordinates:</span>
                          <span className="font-bold text-slate-800">
                            {e.lat.toFixed(5)}° N, {e.lon.toFixed(5)}° E
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-semibold text-slate-500">Time Extracted:</span>
                          <span className="font-bold text-slate-800">
                            {e.timeRef ? e.timeRef : new Date(e.postedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-semibold text-slate-500">Impact Buffer:</span>
                          <span className="font-bold text-blue-700">~{radiusM} meters</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-semibold text-slate-500">Source:</span>
                          <span className="font-bold text-slate-800 capitalize">{e.source || "Social OSINT"}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelect?.(e)}
                      className="w-full mt-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-center text-[11px] font-extrabold text-white shadow hover:bg-blue-700 transition"
                    >
                      Inspect in Command Console
                    </button>
                  </div>
                </Popup>
              </Marker>
            </span>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default LeafletSocialMap;
