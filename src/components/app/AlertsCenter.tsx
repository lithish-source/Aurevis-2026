"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Incident-alert center for the commuter app (client side).
//
// • polls /api/notifications for the signed-in area every 8 s
// • NEW unread incidents pop up as push-style toasts on top of the screen
// • slim banner in the home sheet + floating bell show the unread count
// • tapping opens the NotificationsOverlay with the full advisory
//   (buses affected, metro alternative, other options)

import { useCallback, useEffect, useState } from "react";
import { create } from "zustand";
import { cn } from "@/lib/utils";
import { USER_LOCATION, USER_AREA } from "@/lib/transit-data";
import { useApp } from "@/lib/app-store";
import { ALERT_EVENT_META, ALERT_SEV_COLOR, type CitizenAlert } from "@/lib/alerts";

// ── tiny store shared by toasts / bell / banner ─────────────────────────────

type AlertsState = {
  alerts: CitizenAlert[];
  unread: number;
  seen: Set<string>; // ids already toasted (survives list refreshes)
  area: { label: string; lat: number; lon: number };
  setArea: (a: { label: string; lat: number; lon: number }) => void;
  markSeen: (id: string) => void;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
};

/** selectable demo areas — the "user near X" used for geo-targeting */
export const DEMO_AREAS = [
  { label: "Ramapuram", lat: 13.032, lon: 80.1755 },
  { label: "Poonamallee", lat: 13.0467, lon: 80.0942 },
  { label: "T Nagar", lat: 13.0418, lon: 80.2341 },
  { label: "Guindy", lat: 13.0067, lon: 80.2206 },
  { label: "Vadapalani", lat: 13.0474, lon: 80.2126 },
  { label: "Sholinganallur (OMR)", lat: 12.9016, lon: 80.2279 },
];

/** Toasted-alert memory, persisted so popups survive view switches and
 *  reloads (only genuinely NEW alerts pop, never history). */
const SEEN_KEY = "chennai-one:seen-alerts";
function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveSeen(s: Set<string>) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-300)));
  } catch {
    /* private mode etc. */
  }
}

export const useAlerts = create<AlertsState>((set, get) => ({
  alerts: [],
  unread: 0,
  seen: loadSeen(),
  area: { label: USER_AREA, ...USER_LOCATION },
  setArea: (area) => {
    set({ area });
    void get().refresh();
  },
  markSeen: (id) => {
    const next = new Set(get().seen).add(id);
    saveSeen(next);
    set({ seen: next });
  },
  markAllRead: async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => undefined);
    set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })), unread: 0 }));
  },
  refresh: async () => {
    const { area } = get();
    try {
      const r = await fetch(`/api/notifications?lat=${area.lat}&lon=${area.lon}&limit=25`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = (await r.json()) as { alerts: CitizenAlert[]; unread: number };
      set({ alerts: data.alerts, unread: data.unread });
    } catch {
      /* offline — keep last state */
    }
  },
}));

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

// ── push-style toast ─────────────────────────────────────────────────────────

function AlertToast({ alert, onClose, onOpen }: { alert: CitizenAlert; onClose: () => void; onOpen: () => void }) {
  const sev = alert.meta?.severity ?? "medium";
  const ev = ALERT_EVENT_META[alert.meta?.eventType ?? "other"] ?? ALERT_EVENT_META.other;
  const cleared = alert.kind === "cleared";
  return (
    <div
      role="alert"
      className="pointer-events-auto w-full overflow-hidden rounded-2xl bg-white/95 shadow-[0_10px_36px_rgba(17,17,17,0.28)] backdrop-blur animate-[toastin_0.42s_cubic-bezier(0.22,1,0.36,1)]"
    >
      <div className="h-1 w-full" style={{ background: cleared ? "#0E8A4F" : ALERT_SEV_COLOR[sev] ?? "#C77E12" }} />
      <button onClick={onOpen} className="flex w-full items-start gap-2.5 px-3 pb-2.5 pt-2.5 text-left" aria-label={`Open alert: ${alert.headline}`}>
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px]"
          style={{ background: cleared ? "#E7F6EE" : `${ALERT_SEV_COLOR[sev] ?? "#C77E12"}1A` }}
          aria-hidden
        >
          {cleared ? "✅" : ev.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: cleared ? "#0E8A4F" : ALERT_SEV_COLOR[sev] ?? "#C77E12" }}>
              {cleared ? "All clear" : alert.kind === "escalation" ? "Update" : "Near you"}
            </span>
            <span className="text-[9px] font-semibold text-slate-400">{timeAgo(alert.createdAt)}</span>
          </span>
          <span className="mt-0.5 block text-[12px] font-bold leading-snug text-slate-800">{alert.headline}</span>
          <span className="mt-0.5 block truncate text-[10.5px] leading-snug text-slate-500">{alert.body.split("\n")[1] ?? alert.body}</span>
        </span>
      </button>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

// ── the polling center (mount once inside the phone) ────────────────────────

export function IncidentNotificationCenter() {
  const { alerts, unread, seen, markSeen, refresh, area } = useAlerts();
  const { openOverlay, overlay } = useApp();
  const [toasts, setToasts] = useState<CitizenAlert[]>([]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 8000);
    return () => clearInterval(t);
  }, [refresh]);

  // alerts never toasted before → pop them up. `seen` is persisted in
  // localStorage, so history stays silent while genuinely NEW alerts (fresh
  // replay reports, admin all-clears…) still pop, even after a view switch
  // or reload. Old-but-unseen alerts are absorbed silently.
  useEffect(() => {
    const unseen = alerts.filter((a) => !seen.has(a.id));
    if (unseen.length === 0) return;
    const TEN_MIN = 10 * 60_000;
    const fresh = unseen.filter((a) => !a.read && Date.now() - new Date(a.createdAt).getTime() < TEN_MIN);
    const t = setTimeout(() => {
      unseen.forEach((a) => markSeen(a.id));
      if (fresh.length > 0) {
        const pick = fresh.slice(0, 3);
        setToasts((cur) => [...pick, ...cur].slice(0, 3));
        const t2 = setTimeout(() => setToasts((cur) => cur.slice(0, Math.max(0, cur.length - pick.length))), 12000);
        return () => clearTimeout(t2);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [alerts, seen, markSeen]);

  const dismiss = useCallback((id: string) => setToasts((cur) => cur.filter((t) => t.id !== id)), []);
  const open = useCallback(() => {
    setToasts([]);
    openOverlay("notifications");
  }, [openOverlay]);

  return (
    <>
      {/* push-style popups (hidden when inside notifications overlay) */}
      {overlay !== "notifications" && (
        <div className="pointer-events-none absolute inset-x-3 top-11 z-[70] flex flex-col gap-2">
          {toasts.map((a) => (
            <div key={a.id} className="relative">
              <AlertToast alert={a} onClose={() => dismiss(a.id)} onOpen={open} />
            </div>
          ))}
        </div>
      )}

      {/* floating bell — only visible on main screens, hidden when an overlay (search, notifications, report, etc.) is open */}
      {!overlay && (
        <button
          onClick={open}
          aria-label={`Alerts near ${area.label}${unread ? ` — ${unread} unread` : ""}`}
          className="absolute left-3 top-11 z-[55] flex h-9 items-center gap-1.5 rounded-full bg-[#1C1C1E]/92 py-1.5 pl-2 pr-2.5 text-white shadow-lg shadow-black/25 backdrop-blur transition active:scale-95 animate-fade-in"
        >
          <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#FF3B30] px-[3px] text-[8.5px] font-extrabold">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </span>
          <span className="text-[10px] font-bold tracking-wide">Alerts</span>
          {unread > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B30]" aria-hidden />}
        </button>
      )}
    </>
  );
}

// ── slim banner for the home sheet ──────────────────────────────────────────

export function AreaAlertBanner() {
  const { alerts, unread, refresh, area } = useAlerts();
  const { openOverlay } = useApp();

  useEffect(() => {
    void refresh();
  }, [refresh, area]);

  if (alerts.length === 0) return null;
  // incidents whose report has since been resolved (a newer "cleared" alert
  // with the same reportId) are superseded — show the all-clear instead
  const clearedReportIds = new Set(alerts.filter((a) => a.kind === "cleared" && a.reportId).map((a) => a.reportId as string));
  const top = alerts.find((a) => a.kind !== "cleared" && !clearedReportIds.has(a.reportId ?? "")) ?? alerts[0];
  const ev = ALERT_EVENT_META[top.meta?.eventType ?? "other"] ?? ALERT_EVENT_META.other;
  const cleared = top.kind === "cleared";

  return (
    <button
      onClick={() => openOverlay("notifications")}
      className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2.5 text-left transition active:scale-[0.99]"
      aria-label="Open alerts near your area"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px]"
        style={{ background: cleared ? "#E7F6EE" : `${ALERT_SEV_COLOR[top.meta?.severity ?? "medium"]}1A` }}
        aria-hidden
      >
        {cleared ? "✅" : ev.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-[#7A4A00]">
          {unread > 0 ? `${unread} new alert${unread > 1 ? "s" : ""} near ${area.label}` : `Latest alert near ${area.label}`}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] font-semibold leading-snug text-slate-700">{top.headline}</span>
      </span>
      <span className="ml-1 flex shrink-0 items-center gap-1 rounded-full bg-[#7A4A00]/10 px-2 py-1 text-[9.5px] font-extrabold uppercase tracking-wide text-[#7A4A00]">
        View
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}
