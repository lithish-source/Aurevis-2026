"use client";

import { create } from "zustand";

export type Tab = "home" | "tickets" | "pass" | "account";

export type Overlay =
  | "planner" // journey / travel planner
  | "busDetail" // live bus tracking detail (map + timeline)
  | "timetable" // metro timetable with countdown
  | "qrScan" // BUS QR scanner
  | "safety" // SOS safety setup
  | "explore" // Heritage / Museum / Park listings
  | "busBooking" // scan & book flow
  | "metroBooking"
  | "place"
  | "serviceDetail"
  | "search"
  | "liveTracking" // full-screen live bus / metro tracking
  | "services" // GCC city services browser
  | "notifications" // incident alerts near the user's area
  | "reportIncident" // citizen "see something? report it" flow
  | "datasets"; // CUMTA GTFS transit data catalog

export type PlannerMode = "bus" | "train" | "metro" | "search";

/** Mode the Live overlay opens in (Bus / Metro / City Pulse social map). */
export type LiveMode = "bus" | "metro" | "pulse";

type AppState = {
  tab: Tab;
  overlay: Overlay | null;
  plannerMode: PlannerMode;
  liveMode: LiveMode;
  exploreCategory: string;
  selectedPlace: string | null;
  selectedService: string | null;
  searchQuery: string;
  setTab: (t: Tab) => void;
  openOverlay: (o: Overlay) => void;
  closeOverlay: () => void;
  setPlannerMode: (m: PlannerMode) => void;
  setLiveMode: (m: LiveMode) => void;
  setExploreCategory: (c: string) => void;
  setSelectedPlace: (p: string | null) => void;
  setSelectedService: (s: string | null) => void;
  setSearchQuery: (q: string) => void;
};

export const useApp = create<AppState>((set) => ({
  tab: "home",
  overlay: null,
  plannerMode: "bus",
  liveMode: "bus",
  exploreCategory: "Heritage",
  selectedPlace: null,
  selectedService: null,
  searchQuery: "",
  setTab: (tab) => set({ tab, overlay: null }),
  openOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: null }),
  setPlannerMode: (plannerMode) => set({ plannerMode }),
  setLiveMode: (liveMode) => set({ liveMode }),
  setExploreCategory: (exploreCategory) => set({ exploreCategory }),
  setSelectedPlace: (selectedPlace) => set({ selectedPlace }),
  setSelectedService: (selectedService) => set({ selectedService }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
