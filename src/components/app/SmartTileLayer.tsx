"use client";

import { useRef, useState } from "react";
import { TileLayer } from "react-leaflet";

// ─────────────────────────────────────────────────────────────────────────────
// Keyless basemap: OpenStreetMap France "HOT" style (clean light map, closest
// to the reference's Google-light look). If tiles start failing it falls back
// to the official openstreetmap.org raster tiles automatically.

const HOT_URL = "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function SmartTileLayer() {
  const [provider, setProvider] = useState<"hot" | "osm">("hot");
  const errors = useRef(0);

  return (
    <TileLayer
      key={provider}
      url={provider === "hot" ? HOT_URL : OSM_URL}
      subdomains={provider === "hot" ? "abc" : ""}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      maxZoom={19}
      crossOrigin
      eventHandlers={{
        tileerror: () => {
          errors.current += 1;
          if (provider === "hot" && errors.current > 4) setProvider("osm");
        },
      }}
    />
  );
}
