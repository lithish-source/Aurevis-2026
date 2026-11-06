"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-store";
import { BottomNav } from "@/components/app/BottomNav";
import { HomeScreen } from "@/components/app/screens/HomeScreen";
import { ServicesScreen } from "@/components/app/screens/ServicesScreen";
import { LiveScreen } from "@/components/app/screens/LiveScreen";
import { TicketScreen } from "@/components/app/screens/TicketScreen";
import { ProfileScreen } from "@/components/app/screens/ProfileScreen";
import { PassScreen } from "@/components/app/screens/PassScreen";
import { PlannerOverlay } from "@/components/app/subscreens/PlannerOverlay";
import { BusDetailOverlay, TimetableOverlay } from "@/components/app/subscreens/BusDetailOverlay";
import { Splash } from "@/components/app/TriangleLogo";
import { IncidentNotificationCenter } from "@/components/app/AlertsCenter";
import { NotificationsOverlay } from "@/components/app/subscreens/NotificationsOverlay";
import { ReportIncidentOverlay } from "@/components/app/subscreens/ReportIncidentOverlay";
import { DataCatalogOverlay } from "@/components/app/subscreens/DataCatalogOverlay";
import {
  QrScanOverlay,
  SafetyOverlay,
  ExploreOverlay,
  SearchOverlay,
  ServiceDetailOverlay,
  MetroBookingOverlay,
  PlaceOverlay,
} from "@/components/app/subscreens/Overlays";

function StatusClock() {
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.7.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.5.6 3.7.1.4 0 .8-.2 1l-2.3 2.1z" />
      </svg>
      <span suppressHydrationWarning>4:35</span>
    </span>
  );
}

/** Transparent status bar that floats over the map hero. */
function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex h-9 items-center justify-between bg-white/0 px-6 text-[#111]">
      <StatusClock />
      <div className="absolute left-1/2 top-1.5 h-6 w-28 -translate-x-1/2 rounded-full bg-black/85" aria-hidden />
      <span className="flex items-center gap-1.5">
        {/* signal */}
        <svg viewBox="0 0 24 14" className="h-3 w-4" aria-hidden>
          <g fill="currentColor">
            <rect x="0" y="9" width="3.4" height="5" rx="1" />
            <rect x="5" y="6.5" width="3.4" height="7.5" rx="1" />
            <rect x="10" y="4" width="3.4" height="10" rx="1" />
            <rect x="15" y="1.5" width="3.4" height="12.5" rx="1" opacity="0.4" />
          </g>
        </svg>
        <span className="text-[9.5px] font-bold tracking-wide">LTE</span>
        {/* battery */}
        <span className="flex items-center">
          <span className="h-2.5 w-5 rounded-[3px] border border-[#111]/70 p-[1.5px]">
            <span className="block h-full w-4/5 rounded-[1.5px] bg-[#111]" />
          </span>
          <span className="ml-[1px] h-1 w-0.5 rounded-r bg-[#111]/70" />
        </span>
      </span>
    </div>
  );
}

function ScreenRouter() {
  const { tab } = useApp();
  switch (tab) {
    case "tickets":
      return <TicketScreen />;
    case "pass":
      return <PassScreen />;
    case "account":
      return <ProfileScreen />;
    default:
      return <HomeScreen />;
  }
}

/** Thin full-screen wrapper with a floating close button, used to host
 *  existing tab screens (live tracking, city services) as overlays. */
function ScreenOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#F1F0F4] animate-[sheetin_0.32s_cubic-bezier(0.22,1,0.36,1)]">
      <header className="relative flex items-center gap-3 bg-white px-4 pb-3 pt-4 shadow-[0_2px_12px_rgba(17,17,17,0.08)]">
        <button
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F0F4] text-[#111] transition active:scale-90"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#111]">{title}</h1>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function OverlayRouter() {
  const { overlay, closeOverlay } = useApp();
  switch (overlay) {
    case "planner":
      return <PlannerOverlay />;
    case "busDetail":
      return <BusDetailOverlay />;
    case "timetable":
      return <TimetableOverlay />;
    case "qrScan":
    case "busBooking":
      return <QrScanOverlay />;
    case "metroBooking":
      return <MetroBookingOverlay />;
    case "safety":
      return <SafetyOverlay />;
    case "explore":
      return <ExploreOverlay />;
    case "place":
      return <PlaceOverlay />;
    case "serviceDetail":
      return <ServiceDetailOverlay />;
    case "search":
      return <SearchOverlay />;
    case "notifications":
      return <NotificationsOverlay />;
    case "reportIncident":
      return <ReportIncidentOverlay />;
    case "datasets":
      return <DataCatalogOverlay />;
    case "liveTracking":
      return (
        <ScreenOverlay title="Live Tracking" onClose={closeOverlay}>
          <LiveScreen />
        </ScreenOverlay>
      );
    case "services":
      return (
        <ScreenOverlay title="City Services" onClose={closeOverlay}>
          <ServicesScreen />
        </ScreenOverlay>
      );
    default:
      return null;
  }
}

/** The Chennai One mobile app rendered inside a phone frame. */
export function ChennaiOneApp() {
  // boot splash — triangle logo intro, fades out after ~1.5s
  const [splash, setSplash] = useState<"on" | "leaving" | "off">("on");
  useEffect(() => {
    const t1 = setTimeout(() => setSplash("leaving"), 1500);
    const t2 = setTimeout(() => setSplash("off"), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-rose-100 p-4 sm:p-8">
      {/* phone frame */}
      <div className="relative w-full max-w-[400px]">
        <div className="relative h-[844px] max-h-[calc(100vh-4rem)] overflow-hidden rounded-[44px] border-[10px] border-[#1B1F26] bg-[#F1F0F4] shadow-2xl shadow-slate-900/30">
          {/* screen */}
          <div className="relative flex h-full flex-col">
            <main className="relative flex-1 overflow-hidden">
              <ScreenRouter />
              <OverlayRouter />
              <IncidentNotificationCenter />
            </main>
            <StatusBar />
            <BottomNav />
            {splash !== "off" && <Splash leaving={splash === "leaving"} />}
          </div>
        </div>
        {/* frame buttons */}
        <span className="absolute -left-[13px] top-28 h-16 w-[3px] rounded-l bg-[#1B1F26]" aria-hidden />
        <span className="absolute -left-[13px] top-48 h-16 w-[3px] rounded-l bg-[#1B1F26]" aria-hidden />
        <span className="absolute -right-[13px] top-36 h-24 w-[3px] rounded-r bg-[#1B1F26]" aria-hidden />
      </div>
    </div>
  );
}
