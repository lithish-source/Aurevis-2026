"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so both maps load client-side only.
export const CityMapLeaflet = dynamic(
  () => import("@/components/app/LeafletCityMap").then((m) => m.LeafletCityMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-[#EAF3F6]" />,
  },
);

export const RouteMapLeaflet = dynamic(
  () => import("@/components/app/LeafletRouteMap").then((m) => m.LeafletRouteMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-[#EDF2E9]" />,
  },
);
