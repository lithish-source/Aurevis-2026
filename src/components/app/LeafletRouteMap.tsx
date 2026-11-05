"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { USER_LOCATION } from "@/lib/transit-data";
import { etaBubbleIcon, userDotIcon, vehicleIcon } from "@/components/app/map-icons";
import { SmartTileLayer } from "@/components/app/SmartTileLayer";

// ─────────────────────────────────────────────────────────────────────────────
// Live route tracker on a real Leaflet map: route polyline (white casing +
// animated blue dashes), stop dots, a moving vehicle interpolated along the
// route by `progress`, an ETA bubble and the user location dot.

export type RouteStop = { name: string; lat: number; lon: number; passed?: boolean };

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = points.reduce(
      (b, p) => b.extend(p),
      map.getBounds().pad(-0.35), // start from a slightly shrunk bounds
    );
    map.fitBounds(bounds.pad(0.18), { animate: false });
    const t = setTimeout(() => map.invalidateSize({ animate: false }), 250);
    return () => clearTimeout(t);
     
  }, []);
  return null;
}

function ResizeWatch() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Interpolate a position along the stop chain for the vehicle marker. */
function pointAt(points: [number, number][], progress: number): [number, number] {
  const t = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const i0 = Math.floor(t);
  const i1 = Math.min(points.length - 1, i0 + 1);
  const f = t - i0;
  return [
    points[i0][0] + (points[i1][0] - points[i0][0]) * f,
    points[i0][1] + (points[i1][1] - points[i0][1]) * f,
  ];
}

export function LeafletRouteMap({
  className = "",
  stops,
  progress = 0.45,
  vehicle = "bus",
  eta,
  showUserPin = true,
  onDetails,
  detailsButton = true,
}: {
  className?: string;
  stops: RouteStop[];
  /** 0..1 position of the vehicle along the route */
  progress?: number;
  vehicle?: "bus" | "metro";
  /** ETA bubble anchored to a stop index */
  eta?: { stopIndex: number; text: string };
  showUserPin?: boolean;
  onDetails?: () => void;
  detailsButton?: boolean;
}) {
  const points = useMemo(() => stops.map((s) => [s.lat, s.lon] as [number, number]), [stops]);
  const vehiclePos = useMemo(() => pointAt(points, progress), [points, progress]);

  return (
    <div className={cn("relative overflow-hidden bg-[#EDF2E9]", className)} aria-label="Live route map">
      <MapContainer
        center={vehiclePos}
        zoom={13}
        minZoom={11}
        maxZoom={18}
        zoomControl={false}
        attributionControl
        preferCanvas
        style={{ height: "100%", width: "100%" }}
      >
        <SmartTileLayer />
        <ResizeWatch />
        <FitBounds points={points} />

        {/* route: white casing then animated blue dashes */}
        <Polyline positions={points} pathOptions={{ color: "#FFFFFF", weight: 9, lineCap: "round", lineJoin: "round" }} />
        <Polyline positions={points} pathOptions={{ color: "#1A56DB", weight: 5, lineCap: "round", lineJoin: "round", className: "c1-route" }} />

        {/* stop dots */}
        {stops.map((s, i) => (
          <CircleMarker
            key={s.name}
            center={[s.lat, s.lon]}
            radius={6}
            pathOptions={{
              color: s.passed ? "#8B95A5" : "#1A56DB",
              weight: 3,
              fillColor: s.passed ? "#B9C2D0" : "#FFFFFF",
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              {s.name}
            </Tooltip>
          </CircleMarker>
        ))}

        {/* ETA bubble */}
        {eta && stops[eta.stopIndex] && (
          <Marker position={[stops[eta.stopIndex].lat, stops[eta.stopIndex].lon]} icon={etaBubbleIcon(eta.text)} interactive={false} />
        )}

        {/* user location dot */}
        {showUserPin && <Marker position={[USER_LOCATION.lat, USER_LOCATION.lon]} icon={userDotIcon()} />}

        {/* moving vehicle */}
        <Marker position={vehiclePos} icon={vehicleIcon(vehicle)} zIndexOffset={1000} />
      </MapContainer>

      {/* Details pill (HTML overlay, above map) */}
      {detailsButton && onDetails && (
        <button
          onClick={onDetails}
          className="absolute right-3 top-3 z-[500] rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-700 shadow-lg shadow-black/15 transition active:scale-95"
        >
          Details
        </button>
      )}
    </div>
  );
}

export default LeafletRouteMap;
