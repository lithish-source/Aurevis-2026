"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so the social map loads client-side only.
export const SocialMapLeaflet = dynamic(
  () => import("@/components/app/LeafletSocialMap").then((m) => m.LeafletSocialMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-[#EAF3F6]" />,
  },
);

export type { PulseMapEvent } from "@/components/app/LeafletSocialMap";
