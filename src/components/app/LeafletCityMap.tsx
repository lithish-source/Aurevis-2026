"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import {
  MAP_BUS_STOPS,
  MAP_METRO_STATIONS,
  MAP_RAILWAY_STATIONS,
  USER_LOCATION,
  type MapPin,
} from "@/lib/transit-data";
import { busStopIcon, metroIcon, railwayIcon, userPinIcon } from "@/components/app/map-icons";
import { SmartTileLayer } from "@/components/app/SmartTileLayer";

// ─────────────────────────────────────────────────────────────────────────────
// Real Leaflet neighbourhood map (OpenStreetMap light tiles) behind the home
// bottom sheet. Pins can come straight from /api/transit/stops/nearby (with
// distances) or fall back to the static list.

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
  stops,
}: {
  className?: string;
  showBus?: boolean;
  showMetro?: boolean;
  showRailway?: boolean;
  /** API-provided pins (preferred); falls back to static data per category. */
  stops?: NearbyStopPin[];
}) {
  const fromApi = (category: "bus" | "metro" | "railway") =>
    stops?.filter((s) => (s as { category?: string }).category === category);

  const busPins = fromApi("bus")?.length ? (fromApi("bus") as NearbyStopPin[]) : MAP_BUS_STOPS;
  const metroPins = fromApi("metro")?.length ? (fromApi("metro") as NearbyStopPin[]) : MAP_METRO_STATIONS;
  const railPins = fromApi("railway")?.length ? (fromApi("railway") as NearbyStopPin[]) : MAP_RAILWAY_STATIONS;

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
