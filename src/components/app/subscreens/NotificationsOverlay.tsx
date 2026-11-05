"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Notifications overlay — full list of geo-targeted incident alerts for the
// user's area, with the transport advisory (MTC impact + Metro alternative +
// other options) spelled out.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-store";
import { useAlerts, DEMO_AREAS } from "@/components/app/AlertsCenter";
import { ALERT_EVENT_META, ALERT_SEV_COLOR, type CitizenAlert } from "@/lib/alerts";

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AlertCard({ alert }: { alert: CitizenAlert }) {
  const sev = alert.meta?.severity ?? "medium";
  const ev = ALERT_EVENT_META[alert.meta?.eventType ?? "other"] ?? ALERT_EVENT_META.other;
  const cleared = alert.kind === "cleared";
  const advisory = alert.meta?.advisory;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[22px] bg-white shadow-sm",
        !alert.read && !cleared && "ring-2 ring-orange-200",
      )}
    >
      <div className="h-1.5 w-full" style={{ background: cleared ? "#0E8A4F" : ALERT_SEV_COLOR[sev] ?? "#C77E12" }} />
      <div className="p-3.5">
        {/* header */}
        <div className="flex items-start gap-2.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[19px]"
            style={{ background: cleared ? "#E7F6EE" : `${ALERT_SEV_COLOR[sev] ?? "#C77E12"}1A` }}
            aria-hidden
          >
            {cleared ? "✅" : ev.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="rounded-full px-2 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider"
                style={{
                  color: cleared ? "#0E8A4F" : ALERT_SEV_COLOR[sev] ?? "#C77E12",
                  background: cleared ? "#E7F6EE" : `${ALERT_SEV_COLOR[sev] ?? "#C77E12"}1A`,
                }}
              >
                {cleared ? "All clear" : alert.kind === "escalation" ? "Update · near you" : "Incident · near you"}
              </span>
              {!alert.read && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" aria-label="unread" />}
              <span className="ml-auto text-[9.5px] font-semibold text-slate-400">{timeAgo(alert.createdAt)}</span>
            </div>
            <h3 className="mt-1 text-[13.5px] font-bold leading-snug text-slate-800">{alert.headline}</h3>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
              {fmtDateTime(alert.createdAt)} · {alert.areaLabel.replace(/ \(.*\)$/, "")} · within {alert.radiusKm} km of you
            </p>
          </div>
        </div>

        {/* advisory */}
        <p className="mt-2.5 whitespace-pre-line text-[12px] leading-relaxed text-slate-600">{alert.body}</p>

        {advisory && !cleared && (
          <div className="mt-2.5 space-y-1.5 rounded-2xl bg-slate-50 p-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-[1px] text-[13px]" aria-hidden>🚌</span>
              <p className="text-[11px] font-medium leading-snug text-slate-600">{advisory.busNote}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-[1px] text-[13px]" aria-hidden>🚇</span>
              <p className="text-[11px] font-medium leading-snug text-slate-600">{advisory.metroNote}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-[1px] text-[13px]" aria-hidden>💡</span>
              <p className="text-[11px] font-medium leading-snug text-slate-500">{advisory.extra}</p>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function NotificationsOverlay() {
  const { closeOverlay } = useApp();
  const { alerts, unread, markAllRead, area, setArea } = useAlerts();
  const listRef = useRef<HTMLDivElement>(null);
  const [marking, setMarking] = useState(false);

  // auto-mark-as-read a few seconds after the overlay is opened
  useEffect(() => {
    if (unread === 0) return;
    const t = setTimeout(async () => {
      setMarking(true);
      await markAllRead();
      setMarking(false);
    }, 2500);
    return () => clearTimeout(t);
  }, [unread, markAllRead]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [alerts.length]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#F1F0F4] animate-[sheetin_0.32s_cubic-bezier(0.22,1,0.36,1)]">
      <header className="relative flex items-center gap-3 bg-white px-4 pb-3 pt-4 shadow-[0_2px_12px_rgba(17,17,17,0.08)]">
        <button
          onClick={closeOverlay}
          aria-label="Close notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F0F4] text-[#111] transition active:scale-90"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-bold text-[#111]">Alerts near you</h1>
          <div className="mt-0.5 flex items-center gap-0.5 text-[11px] font-medium text-slate-400">
            <span aria-hidden>📍</span>
            <label htmlFor="area-select" className="sr-only">Choose your area</label>
            <select
              id="area-select"
              value={area.label}
              onChange={(e) => {
                const a = DEMO_AREAS.find((d) => d.label === e.target.value);
                if (a) setArea(a);
              }}
              className="cursor-pointer appearance-none rounded-md bg-transparent py-0.5 font-bold text-[#1A2B49] focus:outline-none"
            >
              {!DEMO_AREAS.some((d) => d.label === area.label) && <option value="">{area.label}</option>}
              {DEMO_AREAS.map((a) => (
                <option key={a.label} value={a.label}>
                  {a.label}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span className="ml-0.5">· {alerts.length} alert{alerts.length === 1 ? "" : "s"}{marking ? " · marking read…" : ""}</span>
          </div>
        </div>
        {unread > 0 && (
          <span className="flex h-6 items-center rounded-full bg-orange-100 px-2.5 text-[10px] font-extrabold text-orange-700">
            {unread} new
          </span>
        )}
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-6">
        {alerts.length === 0 ? (
          <div className="mt-16 flex flex-col items-center px-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-[28px]" aria-hidden>
              🔔
            </span>
            <p className="mt-4 text-[14px] font-bold text-slate-700">All calm around {area.label}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              When the city detects a traffic, flood or transit issue near you, you&apos;ll get a notification here with the best way
              to travel — including whether to switch to the Metro.
            </p>
          </div>
        ) : (
          alerts.map((a) => <AlertCard key={a.id} alert={a} />)
        )}
      </div>
    </div>
  );
}
