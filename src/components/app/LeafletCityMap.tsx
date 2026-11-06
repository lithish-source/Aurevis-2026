"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, Tooltip, Popup, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import {
  MAP_BUS_STOPS,
  MAP_METRO_STATIONS,
  MAP_RAILWAY_STATIONS,
  USER_LOCATION,
  type MapPin,
} from "@/lib/transit-data";
import { busStopIcon, metroIcon, railwayIcon, userPinIcon, socialEventIcon } from "@/components/app/map-icons";
import { SmartTileLayer } from "@/components/app/SmartTileLayer";
import { type PulseMapEvent, TYPE_GLYPH, TYPE_LABEL } from "@/components/app/LeafletSocialMap";

// ─────────────────────────────────────────────────────────────────────────────
// Real Leaflet neighbourhood map (OpenStreetMap light tiles) behind the home
// bottom sheet. Pins can come straight from /api/transit/stops/nearby (with
// distances) or fall back to the static list. Supports live NLP mobility incident
// layers with impact buffer halos and transit advisories.

export type NearbyStopPin = MapPin & { distanceM?: number };

/** Keeps the map in sync with its container size (the bottom sheet reveals it
 *  progressively) and handles the external "locate me" button. */
function MapHousekeeping() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(container);
    // initial layout pass once fonts/tiles settle
    const t = setTimeout(() => map.invalidateSize({ animate: false }), 250);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [map]);

  useEffect(() => {
    const onLocate = () => map.setView([USER_LOCATION.lat, USER_LOCATION.lon], 16, { animate: true });
    window.addEventListener("chennai-one:locate", onLocate);
    return () => window.removeEventListener("chennai-one:locate", onLocate);
  }, [map]);
  return null;
}

export function LeafletCityMap({
  className = "",
  showBus = true,
  showMetro = true,
  showRailway = true,
  showIncidents = true,
  stops,
  incidents: propIncidents,
  onSelectIncident,
}: {
  className?: string;
  showBus?: boolean;
  showMetro?: boolean;
  showRailway?: boolean;
  showIncidents?: boolean;
  /** API-provided pins (preferred); falls back to static data per category. */
  stops?: NearbyStopPin[];
  incidents?: PulseMapEvent[];
  onSelectIncident?: (e: PulseMapEvent) => void;
}) {
  const [fetchedIncidents, setFetchedIncidents] = useState<PulseMapEvent[]>([]);

  useEffect(() => {
    if (propIncidents) return;
    let active = true;
    fetch("/api/reports?status=open&limit=30")
      .then((r) => r.json())
      .then((data: { reports?: Array<{ id: string; eventType: string; severity: string; placeLabel: string; lat: number; lon: number; title: string; summary: string; sentiment?: string; postCount: number; openedAt: string; verification?: string }> }) => {
        if (!active || !data.reports) return;
        const mapped: PulseMapEvent[] = data.reports.map((r) => ({
          id: r.id,
          source: "citizen_alert",
          text: r.summary || r.title,
          eventType: r.eventType,
          severity: r.severity,
          sentiment: r.sentiment ?? "negative",
          placeLabel: r.placeLabel,
          lat: r.lat,
          lon: r.lon,
          trustScore: 0.9,
          verification: r.verification ?? "verified",
          corroborates: Math.max(0, r.postCount - 1),
          postedAt: r.openedAt,
          title: r.title,
        }));
        setFetchedIncidents(mapped);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [propIncidents]);

  const activeIncidents = propIncidents ?? fetchedIncidents;

  const fromApi = (category: "bus" | "metro" | "railway") =>
    stops?.filter((s) => (s as { category?: string }).category === category);

  const busPins: NearbyStopPin[] = fromApi("bus")?.length ? (fromApi("bus") as NearbyStopPin[]) : (MAP_BUS_STOPS as NearbyStopPin[]);
  const metroPins: NearbyStopPin[] = fromApi("metro")?.length ? (fromApi("metro") as NearbyStopPin[]) : (MAP_METRO_STATIONS as NearbyStopPin[]);
  const railPins: NearbyStopPin[] = fromApi("railway")?.length ? (fromApi("railway") as NearbyStopPin[]) : (MAP_RAILWAY_STATIONS as NearbyStopPin[]);

  return (
    <div className={cn("relative h-full w-full", className)} aria-label="Neighbourhood map">
      <MapContainer
        center={[USER_LOCATION.lat, USER_LOCATION.lon]}
        zoom={15}
        minZoom={12}
        maxZoom={18}
        zoomControl={false}
        attributionControl
        preferCanvas
        style={{ height: "100%", width: "100%" }}
      >
        <SmartTileLayer />
        <MapHousekeeping />

        {/* user location — blue walking pin */}
        <Marker position={[USER_LOCATION.lat, USER_LOCATION.lon]} icon={userPinIcon()} zIndexOffset={500}>
          <Tooltip direction="top" offset={[0, -58]} opacity={1}>
            You are here · Ramapuram
          </Tooltip>
        </Marker>

        {/* live mobility incidents layer (NLP classified) */}
        {showIncidents &&
          activeIncidents
            .filter((e) => e.lat != null && e.lon != null)
            .map((e) => {
              const typeInfo = TYPE_LABEL[e.eventType ?? "other"] ?? TYPE_LABEL.other;
              const isHigh = e.severity === "critical" || e.severity === "high";

              return (
                <span key={`incident-${e.id}`}>
                  {isHigh && (
                    <Circle
                      center={[e.lat!, e.lon!]}
                      radius={e.severity === "critical" ? 1200 : 700}
                      pathOptions={{
                        color: e.severity === "critical" ? "#EF4444" : "#F97316",
                        fillColor: e.severity === "critical" ? "#EF4444" : "#F97316",
                        weight: 1.5,
                        opacity: 0.7,
                        fillOpacity: 0.1,
                      }}
                      interactive={false}
                    />
                  )}
                  <Marker
                    position={[e.lat!, e.lon!]}
                    icon={socialEventIcon(
                      e.verification,
                      e.severity,
                      TYPE_GLYPH[e.eventType ?? "other"] ?? "alert",
                      36,
                      e.sentiment,
                    )}
                    eventHandlers={{ click: () => onSelectIncident?.(e) }}
                    zIndexOffset={700}
                  >
                    <Popup className="c1-leaflet-popup">
                      <div className="min-w-[220px] max-w-[260px] p-1 font-sans text-slate-900">
                        <div className="flex items-center gap-1.5 pb-1 border-b border-slate-200">
                          <span className="text-base">{typeInfo.icon}</span>
                          <div>
                            <p className="text-[11.5px] font-black text-slate-900">
                              {typeInfo.label}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500">
                              {e.placeLabel ?? "Ramapuram area"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-1.5 space-y-1">
                          <div className="flex items-center gap-1">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[9px] font-black uppercase text-white",
                                e.severity === "critical"
                                  ? "bg-red-600"
                                  : e.severity === "high"
                                    ? "bg-orange-600"
                                    : "bg-amber-600",
                              )}
                            >
                              {e.severity} severity
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                              {e.sentiment === "negative" ? "🔴 Impacted" : "🟡 Advisory"}
                            </span>
                          </div>

                          <p className="text-[10.5px] leading-snug text-slate-700 font-medium">
                            {e.text}
                          </p>

                          <div className="mt-1 rounded bg-blue-50/80 p-1.5 text-[9.5px] font-medium text-blue-900 border border-blue-100">
                            <span className="font-bold">Spatial Coords:</span> {e.lat!.toFixed(4)}° N, {e.lon!.toFixed(4)}° E
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </span>
              );
            })}

        {/* bus stops */}
        {showBus &&
          busPins.map((s) => (
            <Marker key={`bus-${s.name}`} position={[s.lat, s.lon]} icon={busStopIcon(Boolean(s.active))}>
              <Tooltip direction="top" offset={[0, -38]} opacity={1}>
                {s.name}
                {s.distanceM != null ? ` · ${s.distanceM < 950 ? `${s.distanceM} m` : `${(s.distanceM / 1000).toFixed(1)} km`}` : ""}
              </Tooltip>
            </Marker>
          ))}

        {/* metro stations */}
        {showMetro &&
          metroPins.map((s) => (
            <Marker key={`metro-${s.name}`} position={[s.lat, s.lon]} icon={metroIcon()}>
              <Tooltip direction="top" offset={[0, -30]} opacity={1}>
                {s.name} Metro
              </Tooltip>
            </Marker>
          ))}

        {/* railway stations */}
        {showRailway &&
          railPins.map((s) => (
            <Marker key={`rail-${s.name}`} position={[s.lat, s.lon]} icon={railwayIcon()}>
              <Tooltip direction="top" offset={[0, -28]} opacity={1}>
                {s.name} Railway Stn
              </Tooltip>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}

export default LeafletCityMap;
