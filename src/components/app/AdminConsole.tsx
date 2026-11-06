"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CUMTA Transit Operations Command & Admin Console (Chennai One admin side).
//
// The social/NLP data stream flows in → each incident REPORT pops up here
// (date, time, place, severity, summarised description, commuter advisory,
// trust + corroboration). Duty officers can:
//   • start / stop / reset the replay data stream (or plug a live source)
//   • inject a demo citizen post
//   • RESOLVE a report → pushes an "all clear" notification to nearby users
//
// Companion of the commuter Chennai One phone app.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SocialMapLeaflet, type PulseMapEvent } from "@/components/app/social-maps";
import { ALERT_EVENT_META, type Advisory } from "@/lib/alerts";
import { CUMTA_DATASETS } from "@/lib/cumta-datasets";

// ── types ────────────────────────────────────────────────────────────────────

type IncidentReport = {
  id: string;
  code: string;
  eventType: string;
  severity: string;
  placeLabel: string;
  lat: number;
  lon: number;
  title: string;
  summary: string;
  advisory: Advisory | null;
  status: "open" | "resolved" | string;
  openedAt: string;
  lastScenarioAt: string;
  lastActivityAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  postCount: number;
  maxTrust: number | null;
  verification: string | null;
  scenario: string | null;
  notificationsSent: number;
  photo?: string | null;
  mismatchReason?: string | null;
  source?: string | null;
  authorHandle?: string | null;
  sentiment?: string | null;
  timeRefs?: string[];
  primaryText?: string | null;
};

type ReplayStatus = {
  ok: boolean;
  running?: boolean;
  scenario?: string;
  speed?: number;
  sent?: number;
  total?: number;
  lastError?: string | null;
};

// ── constants ────────────────────────────────────────────────────────────────

const SCENARIOS = [
  { id: "poonamallee-chaos", label: "Poonamallee chaos", desc: "Waterlogging + stalled lorry at the bypass · 26 posts" },
  { id: "monsoon-flood", label: "Monsoon flood", desc: "City-wide NE monsoon downpour · 49 posts" },
  { id: "metro-disruption", label: "Metro fault", desc: "Peak-hour signalling fault, Blue Line · 29 posts" },
  { id: "omr-incident", label: "OMR incident", desc: "Accident + bus breakdown, IT corridor · 27 posts" },
];

const SEV_STYLE: Record<string, string> = {
  low: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  critical: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

const VERIF_STYLE: Record<string, string> = {
  verified: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  unverified: "bg-amber-500/10 text-amber-200/90 border-amber-500/20",
  flagged: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const INJECT_POSTS = [
  { source: "twitter", handle: "citizen_rowdy", author: { accountAgeDays: 1200, followers: 340, verified: false }, text: "Massive jam near Kathipara junction, nothing moving towards the airport. Missing my flight 😩 #ChennaiTraffic" },
  { source: "instagram", handle: "anna_nagar_diaries", author: { accountAgeDays: 2000, followers: 5400, verified: false }, text: "Waterlogging again on 100 ft road Vadapalani near the signal. Autos quoting triple. #ChennaiRains" },
  { source: "facebook", handle: "Ravi Chandran", author: { accountAgeDays: 3000, followers: 800, verified: false }, text: "MTC 570 stuck at Sholinganallur signal for 30 mins. OMR bumper to bumper till Tidel Park." },
  { source: "twitter", handle: "suburban_rail", author: { accountAgeDays: 900, followers: 1500, verified: false }, text: "EMU services Beach to Tambaram delayed 15 mins, platform crowded at Egmore. Announcement says signal fault." },
  { source: "telegram", handle: "City Watch", author: { accountAgeDays: 2000, followers: 8000, verified: false }, text: "Tree fallen on GST road near Chromepet, one lane blocked. Traffic diverted via Radha Nagar. Expect delays." },
];

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── report card ──────────────────────────────────────────────────────────────

function ReportCard({
  report,
  flash,
  onResolve,
  selected,
  onSelect,
}: {
  report: IncidentReport;
  flash: boolean;
  onResolve: (id: string, note: string) => Promise<void>;
  selected: boolean;
  onSelect: () => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ev = ALERT_EVENT_META[report.eventType] ?? ALERT_EVENT_META.other;
  const resolved = report.status === "resolved";
  const advisory = report.advisory;

  return (
    <article
      id={`report-${report.id}`}
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-2xl border bg-[#111827]/80 p-4 shadow-lg shadow-black/20 backdrop-blur transition",
        resolved ? "border-emerald-500/25" : "border-slate-700/60 hover:border-slate-500/60",
        selected && !resolved && "border-indigo-400/60 ring-1 ring-indigo-400/30",
        flash && "animate-[reportpop_0.5s_cubic-bezier(0.22,1,0.36,1)]",
      )}
    >
      {/* ── headline row ── */}
      <div className="flex items-start gap-3">
        <span
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[18px]", SEV_STYLE[report.severity] ?? SEV_STYLE.medium)}
          aria-hidden
        >
          {resolved ? "✅" : ev.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-700/60 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-slate-300">{report.code}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider", SEV_STYLE[report.severity] ?? SEV_STYLE.medium)}>
              {report.severity}
            </span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider", VERIF_STYLE[report.verification ?? "unverified"] ?? VERIF_STYLE.unverified)}>
              {report.verification ?? "unverified"}
            </span>
            {report.source === "reddit" && (
              <span className="flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/15 px-2 py-0.5 text-[9.5px] font-extrabold text-orange-300">
                <svg className="h-2.5 w-2.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.702z" />
                </svg>
                r/Chennai
              </span>
            )}
            {report.source === "citizen_app" && (
              <span className="flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[9.5px] font-extrabold text-sky-300">
                <span>📱</span>
                Citizen App
              </span>
            )}
            {resolved ? (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-400">● Resolved</span>
            ) : (
              <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-orange-300">
                <span className="h-1.5 w-1.5 animate-[softblink_1.6s_ease-in-out_infinite] rounded-full bg-orange-400" aria-hidden />
                Open
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-slate-100">{report.title}</h3>
          {/* date · time · place — the essentials the duty officer needs */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-400">
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M8 3v4M16 3v4M3 11h18" />
              </svg>
              {fmtDateTime(report.openedAt)}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {report.placeLabel.replace(/ \(.*\)$/, "")}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              {timeAgo(report.openedAt)}
            </span>
          </p>
        </div>
      </div>

      {/* ── summarised report body (NLP) ── */}
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-slate-300">{report.summary}</p>

      {/* ── evidence row ── */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-semibold text-slate-400">
        <span className="inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
          </svg>
          {report.postCount} post{report.postCount > 1 ? "s" : ""} aggregated
        </span>
        <span className="inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M12 2l2.4 2.4 3.4-.5.5 3.4L21 9.6l-1.6 3 1.1 3.2-3 1.6-1 3.3-3.4-.4L10.4 22l-2.6-2.2-3.4.4-.9-3.3-2.9-1.7 1.2-3.2L.4 9.5l3-1.8.5-3.4 3.4.5z" />
            <path d="M10.6 15.2l-3-3 1.2-1.2 1.8 1.8 4.6-4.6 1.2 1.2z" fill="#0B0F19" stroke="none" />
          </svg>
          trust {Math.round((report.maxTrust ?? 0) * 100)}%
        </span>
        <span className="inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          {report.notificationsSent} notification{report.notificationsSent === 1 ? "" : "s"} sent
        </span>
        {report.scenario && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500">{report.scenario}</span>
        )}
      </div>

      {/* ── commuter camera evidence ── */}
      {report.photo && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-2.5">
          <img src={report.photo} alt="Attached incident evidence" className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-slate-700" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Commuter Camera Attachment</p>
            {report.verification === "flagged" ? (
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-rose-300">
                ⚠️ {report.mismatchReason || "Discrepancy: Photo does not corroborate reported incident scene."}
              </p>
            ) : (
              <p className="mt-1 text-[11px] font-medium text-slate-400">Live camera capture attached to report.</p>
            )}
          </div>
        </div>
      )}

      {/* ── flagged discrepancy alert ── */}
      {report.verification === "flagged" && (
        <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-rose-200">
          <div className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-rose-300">
            <span>⚠️</span>
            <span>Flagged for Operations Review</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-rose-300/90">
            {report.mismatchReason
              ? report.mismatchReason
              : "AI detected an inconsistency or low corroboration. Severity was throttled to prevent false panic."}
          </p>
          <p className="mt-1.5 text-[9.5px] font-semibold text-rose-400/80">
            Commuter notifications suppressed · Duty officer review required.
          </p>
        </div>
      )}

      {/* ── commuter advisory ── */}
      {advisory && !resolved && (
        <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
          <p className="text-[9.5px] font-extrabold uppercase tracking-widest text-slate-500">Commuter advisory pushed to nearby users</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-[13px]" aria-hidden>🚌</span>
              <p className="text-[11.5px] leading-snug text-slate-300">{advisory.busNote}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[13px]" aria-hidden>🚇</span>
              <p className="text-[11.5px] leading-snug text-slate-300">{advisory.metroNote}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[13px]" aria-hidden>💡</span>
              <p className="text-[11.5px] leading-snug text-slate-400">{advisory.extra}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── resolution ── */}
      {resolved ? (
        <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
          <p className="text-[11.5px] font-bold text-emerald-300">
            ✓ Resolved {report.resolvedAt ? timeAgo(report.resolvedAt) : ""} by {report.resolvedBy ?? "Control Room"}
          </p>
          {report.resolutionNote && <p className="mt-1 text-[11px] leading-snug text-emerald-200/80">“{report.resolutionNote}”</p>}
          <p className="mt-1.5 text-[10px] font-semibold text-emerald-400/70">All-clear notification pushed to users near {report.placeLabel.replace(/ \(.*\)$/, "")}.</p>
        </div>
      ) : (
        <div className="mt-3">
          {!resolving ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setResolving(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-[12px] font-extrabold text-white shadow-lg shadow-emerald-900/40 transition hover:brightness-110 active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Mark resolved
            </button>
          ) : (
            <div onClick={(e) => e.stopPropagation()} className="rounded-xl border border-slate-600/60 bg-slate-800/60 p-3">
              <label htmlFor={`note-${report.id}`} className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                Resolution note (sent to nearby users)
              </label>
              <textarea
                id={`note-${report.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. Water pumped out, both lanes reopened; MTC 54/S26/578 back on normal route."
                className="mt-1.5 w-full resize-none rounded-lg border border-slate-600/60 bg-slate-900/80 p-2.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-emerald-400/60 focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onResolve(report.id, note);
                    setBusy(false);
                    setResolving(false);
                    setNote("");
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-[11.5px] font-extrabold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {busy ? "Resolving…" : "Confirm resolve"}
                </button>
                <button
                  onClick={() => setResolving(false)}
                  className="rounded-lg bg-slate-700 px-3.5 py-1.5 text-[11.5px] font-bold text-slate-300 transition hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ── stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "open" | "ok" | "info" | "flagged" }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-[#111827]/70 p-3.5 backdrop-blur">
      <p className="text-[9.5px] font-extrabold uppercase tracking-widest text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-[26px] font-extrabold leading-none tracking-tight",
          tone === "open" ? "text-orange-300" : tone === "ok" ? "text-emerald-300" : tone === "flagged" ? "text-rose-400" : "text-slate-100",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px] font-semibold text-slate-500">{sub}</p>}
    </div>
  );
}

// ── the console ──────────────────────────────────────────────────────────────

export function AdminConsole() {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [counts, setCounts] = useState({ open: 0, resolved: 0, total: 0, notifications: 0, posts: 0, flagged: 0 });
  const [filter, setFilter] = useState<"open" | "flagged" | "resolved" | "all">("open");
  const [replay, setReplay] = useState<ReplayStatus>({ ok: true, running: false });
  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const [speed, setSpeed] = useState(30);
  const [busy, setBusy] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [popupToasts, setPopupToasts] = useState<IncidentReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDatasets, setShowDatasets] = useState(false);
  const [showSpatialModal, setShowSpatialModal] = useState(false);
  const [redditBusy, setRedditBusy] = useState(false);
  const [redditFeedback, setRedditFeedback] = useState<string | null>(null);
  const [redditCounts, setRedditCounts] = useState<{ total: number; mobility: number }>({ total: 0, mobility: 0 });
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const [clock, setClock] = useState("");

  // live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // close spatial visualizer on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSpatialModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const [rR, rF] = await Promise.all([
        fetch("/api/reports?limit=150", { cache: "no-store" }),
        fetch("/api/social/feed?includeAll=1&limit=1", { cache: "no-store" }),
      ]);
      const data = (await rR.json()) as { reports: IncidentReport[]; counts: { open: number; resolved: number; total: number; notifications: number; flagged?: number } };
      const feed = (await rF.json()) as { counts: { total: number; filteredOut: number } };
      setReports(data.reports);
      setCounts((c) => ({ ...data.counts, flagged: data.counts.flagged ?? 0, posts: feed.counts.total + feed.counts.filteredOut }));

      // popup effect for newly arrived reports
      if (firstLoad.current) {
        data.reports.forEach((r) => knownIds.current.add(r.id));
        firstLoad.current = false;
        return;
      }
      const fresh = data.reports.filter((r) => !knownIds.current.has(r.id) && r.status === "open");
      data.reports.forEach((r) => knownIds.current.add(r.id));
      if (fresh.length > 0) {
        setFlashIds((s) => new Set([...s, ...fresh.map((f) => f.id)]));
        setPopupToasts((t) => [...fresh.slice(0, 3), ...t].slice(0, 3));
        setTimeout(() => setPopupToasts((t) => t.slice(0, Math.max(0, t.length - fresh.length))), 8000);
        setTimeout(
          () =>
            setFlashIds((s) => {
              const n = new Set(s);
              fresh.forEach((f) => n.delete(f.id));
              return n;
            }),
          20000,
        );
      }
    } catch {
      /* keep last state */
    }
  }, []);

  const fetchReplay = useCallback(async () => {
    try {
      const r = await fetch("/api/social/replay", { cache: "no-store" });
      setReplay((await r.json()) as ReplayStatus);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchRedditStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/social/reddit/poll", { cache: "no-store" });
      const data = await r.json();
      if (data.ok) {
        setRedditCounts({
          total: data.totalRedditPosts ?? 0,
          mobility: data.mobilityRedditPosts ?? 0,
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const pollReddit = async () => {
    setRedditBusy(true);
    setRedditFeedback(null);
    try {
      const res = await fetch("/api/social/reddit/poll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json();
      if (data.ok) {
        setRedditCounts({
          total: data.status?.totalRedditPosts ?? 0,
          mobility: data.status?.mobilityRedditPosts ?? 0,
        });
        const createdCount = Array.isArray(data.outcomes)
          ? data.outcomes.filter((o: { action: string }) => o.action === "created").length
          : 0;
        setRedditFeedback(
          `Polled r/Chennai: ${data.inserted ?? 0} new posts ingested (${createdCount} incident report${createdCount === 1 ? "" : "s"} generated)`,
        );
        void fetchReports();
      } else {
        setRedditFeedback(`Error polling Reddit: ${data.error || "Unknown"}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRedditFeedback(`Failed: ${msg}`);
    } finally {
      setRedditBusy(false);
      setTimeout(() => setRedditFeedback(null), 8000);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchReports();
      void fetchReplay();
      void fetchRedditStatus();
    }, 0);
    const t1 = setInterval(() => void fetchReports(), 6000);
    const t2 = setInterval(() => void fetchReplay(), 5000);
    const t3 = setInterval(() => void fetchRedditStatus(), 12000);
    return () => {
      clearTimeout(t);
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
    };
  }, [fetchReports, fetchReplay, fetchRedditStatus]);

  const startReplay = async () => {
    setBusy("replay");
    await fetch("/api/social/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario }),
    }).catch(() => undefined);
    await fetch("/api/social/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario, speed, reset: true }),
    }).catch(() => undefined);
    firstLoad.current = false;
    knownIds.current = new Set();
    setPopupToasts([]);
    setBusy(null);
    void fetchReplay();
  };

  const stopReplay = async () => {
    setBusy("stop");
    await fetch("/api/social/replay", { method: "DELETE" }).catch(() => undefined);
    setBusy(null);
    void fetchReplay();
  };

  const injectPost = async () => {
    setBusy("inject");
    const p = INJECT_POSTS[Math.floor(Math.random() * INJECT_POSTS.length)];
    await fetch("/api/social/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...p, timeScale: 60 }),
    }).catch(() => undefined);
    setBusy(null);
    setTimeout(() => void fetchReports(), 1500);
  };

  const resolve = useCallback(
    async (id: string, note: string) => {
      await fetch("/api/reports/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, note, admin: "CUMTA Control Room" }),
      }).catch(() => undefined);
      await fetchReports();
    },
    [fetchReports],
  );

  const visible = useMemo(
    () =>
      reports.filter((r) =>
        filter === "all"
          ? true
          : filter === "open"
            ? r.status === "open"
            : filter === "flagged"
              ? r.verification === "flagged"
              : r.status === "resolved",
      ),
    [reports, filter],
  );

  const mapEvents: PulseMapEvent[] = useMemo(
    () =>
      reports
        .filter((r) => r.status === "open")
        .map((r) => ({
          id: r.id,
          source: r.source ?? "report",
          handle: r.code,
          text: r.summary,
          eventType: r.eventType,
          severity: r.severity,
          sentiment: r.sentiment ?? (r.severity === "critical" || r.severity === "high" ? "negative" : "neutral"),
          placeLabel: r.placeLabel,
          lat: r.lat,
          lon: r.lon,
          trustScore: r.maxTrust,
          verification: r.verification,
          corroborates: Math.max(0, r.postCount - 1),
          postedAt: r.openedAt,
          timeRef: r.timeRefs?.[0] ?? null,
          title: r.title,
          photo: r.photo ?? null,
          mismatchReason: r.mismatchReason ?? null,
        })),
    [reports],
  );

  const sc = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];
  const replayPct = replay.total ? Math.round(((replay.sent ?? 0) / replay.total) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(120%_120%_at_20%_0%,#101a33_0%,#0B0F19_55%,#070A12_100%)] text-slate-100">
      {/* ── command header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0B0F19]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1A56DB] to-[#232E6B] shadow-lg shadow-blue-900/40" aria-hidden>
            <svg viewBox="0 0 96 96" className="h-7 w-7">
              <path d="M48 14 84 78 H12 Z" fill="#fff" opacity="0.95" />
              <circle cx="48" cy="26" r="5" fill="#1A56DB" />
              <circle cx="26" cy="66" r="5" fill="#1A56DB" />
              <circle cx="70" cy="66" r="5" fill="#1A56DB" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-[15px] font-extrabold leading-tight tracking-tight">CUMTA Transit Operations Command</h1>
            <p className="text-[10.5px] font-semibold text-slate-500">Chennai One · Incident Reports Console · Govt. of Tamil Nadu</p>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={() => setShowSpatialModal(true)}
              className="flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-600/20 px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-blue-200 transition hover:bg-blue-600/30 shadow-sm shadow-blue-900/30"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span>Spatial Visualizer</span>
              <span className="rounded bg-blue-500/30 px-1 py-0.2 text-[8px] text-blue-300 font-mono">{mapEvents.length}</span>
            </button>
            <button
              onClick={() => setShowDatasets((s) => !s)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-wider transition",
                showDatasets
                  ? "border-blue-400 bg-blue-500/20 text-blue-200"
                  : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500",
              )}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              <span>GTFS Datasets</span>
              <span className="rounded bg-blue-500/30 px-1 py-0.2 text-[8px] text-blue-300 font-mono">3</span>
            </button>
            <span className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-wider", replay.running ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-800/60 text-slate-400")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", replay.running ? "animate-[softblink_1.4s_ease-in-out_infinite] bg-emerald-400" : "bg-slate-500")} aria-hidden />
              {replay.running ? `Stream live · ${replay.sent}/${replay.total}` : "Stream idle"}
            </span>
            <span className="hidden rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-1.5 font-mono text-[12px] font-bold tabular-nums text-slate-300 sm:block">{clock}</span>
          </div>
        </div>
      </header>

      {/* ── CUMTA Datasets Modal / Panel ── */}
      {showDatasets && (
        <div className="border-b border-slate-700/80 bg-[#0f172a]/95 p-4 sm:p-6 backdrop-blur shadow-2xl animate-[sheetin_0.25s_cubic-bezier(0.22,1,0.36,1)]">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-extrabold text-white">CUMTA Open Transit Datasets</h2>
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-blue-300 border border-blue-400/30">
                    GODL – India
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-slate-400">
                  Standardized GTFS feeds and GeoJSON spatial network files verified against{" "}
                  <a href="https://test.cumta.org/datasets" target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-300">
                    test.cumta.org/datasets ↗
                  </a>
                </p>
              </div>
              <button
                onClick={() => setShowDatasets(false)}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-700"
              >
                ✕ Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {CUMTA_DATASETS.map((ds) => (
                <div key={ds.id} className="rounded-2xl border border-slate-700/80 bg-[#1e293b]/80 p-4 shadow-lg backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span
                      className="rounded-lg px-2 py-1 text-[11px] font-extrabold text-white"
                      style={{ backgroundColor: ds.accent }}
                    >
                      {ds.shortName}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {ds.format} · {ds.size}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-[14px] font-bold text-slate-100">{ds.agency}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300 line-clamp-2">{ds.description}</p>
                  
                  <div className="mt-3 flex items-center justify-between border-t border-slate-700/60 pt-2 text-[10.5px] text-slate-400">
                    <span>{ds.stats.stopsOrStations.toLocaleString()} stops/stations</span>
                    <span>{ds.stats.linesOrRoutes} lines/routes</span>
                    <span className="font-semibold text-slate-300">{ds.stats.fareRange}</span>
                  </div>

                  <div className="mt-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Included files ({ds.files.length})</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ds.files.map((f) => (
                        <span key={f} className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[8.5px] text-slate-300 border border-slate-700/50">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                    <span className="text-[9.5px] text-slate-400">Updated {ds.lastUpdated}</span>
                    <a
                      href={ds.downloadUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-extrabold text-white shadow transition hover:brightness-110 active:scale-95"
                      style={{ backgroundColor: ds.accent }}
                    >
                      <span>Download ZIP</span>
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── report popups (the "each report should popup" moment) ── */}
      <div className="pointer-events-none fixed inset-x-0 top-[72px] z-50 mx-auto flex max-w-md flex-col gap-2 px-4">
        {popupToasts.map((r) => {
          const ev = ALERT_EVENT_META[r.eventType] ?? ALERT_EVENT_META.other;
          return (
            <div key={r.id} className="pointer-events-auto animate-[reportpop_0.5s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl border border-blue-400/30 bg-[#111827]/95 p-3.5 shadow-2xl shadow-blue-950/50 backdrop-blur">
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/15 text-[16px]" aria-hidden>
                  {ev.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-widest text-blue-300">
                    <span className="h-1.5 w-1.5 animate-[softblink_1.4s_ease-in-out_infinite] rounded-full bg-blue-400" aria-hidden />
                    New incident report · {r.code}
                  </p>
                  <p className="mt-1 text-[13.5px] font-bold leading-snug text-slate-100">{r.title}</p>
                  <p className="mt-0.5 text-[10.5px] font-semibold text-slate-400">
                    {fmtDateTime(r.openedAt)} · {r.placeLabel.replace(/ \(.*\)$/, "")} · {r.severity} severity
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">{r.summary}</p>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase", SEV_STYLE[r.severity] ?? SEV_STYLE.medium)}>{r.severity}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── body ── */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-10 pt-5 sm:px-6">
        {/* stats row */}
        <section aria-label="Operations summary" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Open incidents" value={counts.open} sub="awaiting action" tone={counts.open > 0 ? "open" : "ok"} />
          <StatCard label="Flagged / Review" value={counts.flagged} sub="mismatch / low trust" tone={counts.flagged > 0 ? "flagged" : "ok"} />
          <StatCard label="Resolved today" value={counts.resolved} sub="all-clear pushed" tone="ok" />
          <StatCard label="Posts processed" value={counts.posts} sub="social stream (NLP)" tone="info" />
          <StatCard label="Citizen alerts sent" value={counts.notifications} sub="geo-targeted" tone="info" />
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          {/* ── left: report feed ── */}
          <section aria-label="Incident reports">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-[13px] font-extrabold uppercase tracking-widest text-slate-400">Incident reports</h2>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">{visible.length}</span>
              <div className="ml-auto flex rounded-xl border border-slate-700/60 bg-slate-800/40 p-0.5">
                {(["open", "flagged", "resolved", "all"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "rounded-[10px] px-3 py-1.5 text-[11px] font-extrabold capitalize transition",
                      filter === f ? "bg-indigo-500/90 text-white shadow" : "text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {visible.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700/60 bg-[#111827]/50 p-10 text-center">
                  <p className="text-[13px] font-bold text-slate-300">{filter === "open" ? "No open incidents — city is calm" : "No reports yet"}</p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[11.5px] leading-relaxed text-slate-500">
                    Start the simulated social data stream (right panel) or inject a citizen post. Every mobility event detected by the
                    NLP pipeline becomes a summarised report here, popping up in real time.
                  </p>
                </div>
              ) : (
                visible.map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    flash={flashIds.has(r.id)}
                    onResolve={resolve}
                    selected={selectedId === r.id}
                    onSelect={() => setSelectedId((s) => (s === r.id ? null : r.id))}
                  />
                ))
              )}
            </div>
          </section>

          {/* ── right: data stream control + map ── */}
          <aside className="space-y-5">
            {/* stream control */}
            <section aria-label="Data stream control" className="rounded-2xl border border-slate-700/50 bg-[#111827]/70 p-4 backdrop-blur">
              <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-widest text-slate-400">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
                Social data stream
              </h2>
              <p className="mt-1 text-[10.5px] leading-snug text-slate-500">
                Simulated real-time replay of the labeled social corpus (Insta/FB/X-style posts) through the same ingest API a live
                connector would use.
              </p>

              <label htmlFor="scenario" className="mt-3 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Scenario
              </label>
              <select
                id="scenario"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                disabled={replay.running}
                className="mt-1 w-full rounded-xl border border-slate-600/60 bg-slate-900/80 px-3 py-2 text-[12px] font-semibold text-slate-200 focus:border-indigo-400/60 focus:outline-none disabled:opacity-50"
              >
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} — {s.desc}
                  </option>
                ))}
              </select>

              <label htmlFor="speed" className="mt-3 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Replay speed · {speed}× <span className="font-medium normal-case text-slate-600">(≈{Math.ceil((75 * 60) / speed / 60)} min wall-clock)</span>
              </label>
              <input
                id="speed"
                type="range"
                min={10}
                max={120}
                step={5}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                disabled={replay.running}
                className="mt-1.5 w-full accent-indigo-400 disabled:opacity-50"
              />

              {replay.running ? (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400 transition-all duration-1000" style={{ width: `${replayPct}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10.5px] font-semibold text-slate-400">
                    {replay.sent}/{replay.total} posts ingested · NLP classifying &amp; building reports…
                    {replay.lastError ? <span className="text-rose-400"> · {replay.lastError}</span> : null}
                  </p>
                  <button
                    onClick={() => void stopReplay()}
                    disabled={busy === "stop"}
                    className="mt-2.5 w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-[12px] font-extrabold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {busy === "stop" ? "Stopping…" : "Stop stream"}
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void startReplay()}
                    disabled={busy === "replay"}
                    className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2.5 text-[12px] font-extrabold text-white shadow-lg shadow-indigo-950/50 transition hover:brightness-110 disabled:opacity-50"
                  >
                    {busy === "replay" ? "Starting…" : "▶ Start stream"}
                  </button>
                  <button
                    onClick={() => void injectPost()}
                    disabled={busy === "inject"}
                    title="Inject one random citizen post through the live pipeline"
                    className="rounded-xl border border-slate-600/60 bg-slate-800/60 px-3.5 py-2.5 text-[12px] font-extrabold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    {busy === "inject" ? "…" : "+ Post"}
                  </button>
                </div>
              )}
              <p className="mt-2 text-[9.5px] leading-snug text-slate-600">Start resets this scenario&apos;s data — reports &amp; notifications rebuild live.</p>
            </section>

            {/* live reddit connector */}
            <section aria-label="Reddit live connector" className="rounded-2xl border border-orange-500/25 bg-[#141923]/80 p-4 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-inner">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden>
                      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.702z" />
                    </svg>
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-[13px] font-extrabold uppercase tracking-widest text-orange-200">Reddit Live Radar</h2>
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[8.5px] font-extrabold text-emerald-300 border border-emerald-500/30">
                        <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Crowdsourced OSINT from <span className="font-semibold text-orange-300">r/Chennai</span> &amp; <span className="font-semibold text-orange-300">r/chennaicity</span></p>
                  </div>
                </div>
                <a
                  href="https://reddit.com/r/Chennai"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-bold text-orange-400/80 hover:text-orange-300 underline"
                  title="Open r/Chennai in a new tab"
                >
                  ↗ Subreddit
                </a>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                <div className="text-center flex-1 border-r border-slate-800">
                  <p className="text-[13px] font-extrabold text-slate-100">{redditCounts.total}</p>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">Reddit posts</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-[13px] font-extrabold text-orange-300">{redditCounts.mobility}</p>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">Mobility alerts</p>
                </div>
              </div>

              <button
                onClick={() => void pollReddit()}
                disabled={redditBusy}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 px-4 py-2 text-[12px] font-extrabold text-white shadow-lg shadow-orange-950/40 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {redditBusy ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                    </svg>
                    <span>Polling r/Chennai…</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.702z" />
                    </svg>
                    <span>Fetch Live Reddit (r/Chennai)</span>
                  </>
                )}
              </button>

              {redditFeedback && (
                <p className="mt-2 text-center text-[10.5px] font-semibold text-orange-200/90 animate-fade-in">
                  {redditFeedback}
                </p>
              )}
            </section>

            {/* live map */}
            <section aria-label="Open incidents map" className="overflow-hidden rounded-2xl border border-slate-700/50 bg-[#111827]/70 backdrop-blur">
              <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-[13px] font-extrabold uppercase tracking-widest text-slate-400">Open incidents map</h2>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">{mapEvents.length} pins</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSpatialModal(true)}
                  className="flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-600/20 px-2.5 py-1 text-[10.5px] font-bold text-blue-300 hover:bg-blue-600/30 transition shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span>⛶ Expand Map</span>
                </button>
              </div>
              <div className="h-[300px] w-full">
                {mapEvents.length === 0 ? (
                  <div className="flex h-full items-center justify-center bg-slate-900/40 text-[11.5px] font-semibold text-slate-600">No open incidents to map</div>
                ) : (
                  <SocialMapLeaflet
                    events={mapEvents}
                    onSelect={(e) => setSelectedId(e.id)}
                    showControls={false}
                    selectedId={selectedId}
                  />
                )}
              </div>
              <p className="px-4 pb-3 pt-2 text-[9.5px] leading-snug text-slate-500">
                Spatial pins encode issue glyph, severity pulse halo, and sentiment dots. Click <strong>⛶ Expand Map</strong> for multi-layer filtering and spatial entity inspection.
              </p>
            </section>

            {/* pipeline explainer */}
            <section className="rounded-2xl border border-slate-700/50 bg-[#111827]/70 p-4 backdrop-blur">
              <h2 className="text-[13px] font-extrabold uppercase tracking-widest text-slate-400">How this console gets its data</h2>
              <ol className="mt-2 space-y-1.5 text-[11px] leading-snug text-slate-500">
                <li><span className="font-bold text-slate-400">1 ·</span> Social posts stream in (replay corpus / live connector → <code className="rounded bg-slate-800 px-1 font-mono text-[10px]">/api/social/ingest</code>)</li>
                <li><span className="font-bold text-slate-400">2 ·</span> NLP classifies each post: type, severity, sentiment, places, summary</li>
                <li><span className="font-bold text-slate-400">3 ·</span> Gazetteer geocoding + trust scoring (source · content · corroboration)</li>
                <li><span className="font-bold text-slate-400">4 ·</span> Nearby posts cluster into one <span className="font-semibold text-slate-300">incident report</span> — summarised by LLM</li>
                <li><span className="font-bold text-slate-400">5 ·</span> Nearby commuters get the advisory notification (MTC impact + Metro alternative)</li>
                <li><span className="font-bold text-slate-400">6 ·</span> You resolve it here → everyone gets the all-clear</li>
              </ol>
            </section>
          </aside>
        </div>
      </main>

      {/* ── Full Spatial Visualizer Modal ── */}
      {showSpatialModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#070A12]/95 backdrop-blur-2xl animate-fade-in text-slate-100">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0B0F19]/90 px-6 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20 text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold tracking-tight text-white">
                    Spatial Mobility Visualizer &amp; Incident Inspector
                  </h2>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[9.5px] font-black uppercase text-emerald-300">
                    Live Geocoded Stream
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  NLP extracted locations, coordinates, time references, issue classification, severity halos &amp; sentiment analysis
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[11px] font-mono text-slate-300">
                <span>Total: <strong className="text-white">{mapEvents.length}</strong></span>
                <span>·</span>
                <span>Critical: <strong className="text-rose-400">{mapEvents.filter((e) => e.severity === "critical").length}</strong></span>
                <span>·</span>
                <span>Negative: <strong className="text-amber-400">{mapEvents.filter((e) => e.sentiment === "negative").length}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setShowSpatialModal(false)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
              >
                <span>Close (Esc)</span>
                <span className="text-slate-400">✕</span>
              </button>
            </div>
          </div>

          {/* Modal Body: Map + Inspector Drawer */}
          <div className="relative flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Map Canvas */}
            <div className="relative flex-1 h-[55vh] lg:h-full w-full">
              <SocialMapLeaflet
                events={mapEvents}
                onSelect={(e) => setSelectedId(e.id)}
                selectedId={selectedId}
                showControls={true}
              />
            </div>

            {/* Side Spatial Inspector Drawer */}
            <div className="w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#0B0F19]/95 overflow-y-auto p-5 backdrop-blur-xl space-y-4">
              {(() => {
                const sel = reports.find((r) => r.id === selectedId) ?? null;
                if (!sel) {
                  return (
                    <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/40 text-slate-400 shadow-inner">
                        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-200">Select an Incident Pin</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 max-w-[260px]">
                          Click any marker on the map to inspect its NLP-extracted coordinates, timestamps, sentiment, and transit advisory.
                        </p>
                      </div>
                      {mapEvents.length > 0 && (
                        <div className="w-full pt-4 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">
                            Quick Select Active Incidents:
                          </p>
                          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                            {mapEvents.slice(0, 6).map((ev) => (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => setSelectedId(ev.id)}
                                className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 hover:border-slate-700 hover:bg-slate-800/60 transition flex items-center justify-between"
                              >
                                <div>
                                  <p className="text-xs font-bold text-slate-200">{ev.placeLabel ?? "Chennai"}</p>
                                  <p className="text-[10px] text-slate-500 capitalize">{ev.eventType?.replace(/_/g, " ")}</p>
                                </div>
                                <span className={cn(
                                  "rounded px-2 py-0.5 text-[9px] font-bold uppercase",
                                  ev.severity === "critical" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300",
                                )}>
                                  {ev.severity}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="space-y-4 animate-fade-in">
                    {/* Header Details */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-blue-400">{sel.code}</span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[9.5px] font-bold uppercase text-slate-300">
                          {sel.status}
                        </span>
                      </div>
                      <span className="text-[10.5px] font-mono text-slate-500">
                        {new Date(sel.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Classified Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[10.5px] font-extrabold uppercase text-blue-300">
                        Issue: {sel.eventType.replace(/_/g, " ")}
                      </span>
                      <span className={cn(
                        "rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold uppercase",
                        sel.severity === "critical"
                          ? "bg-red-500/20 border border-red-500/40 text-red-300"
                          : sel.severity === "high"
                            ? "bg-orange-500/20 border border-orange-500/40 text-orange-300"
                            : "bg-amber-500/20 border border-amber-500/40 text-amber-300",
                      )}>
                        Severity: {sel.severity}
                      </span>
                      <span className={cn(
                        "rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold uppercase",
                        sel.sentiment === "negative"
                          ? "bg-rose-500/20 border border-rose-500/30 text-rose-300"
                          : sel.sentiment === "positive"
                            ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                            : "bg-slate-700/50 border border-slate-600 text-slate-300",
                      )}>
                        Sentiment: {sel.sentiment ?? "negative"}
                      </span>
                    </div>

                    {/* Extracted Spatial Coordinates Card */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Extracted Spatial Geolocation</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="rounded-lg bg-slate-800/60 p-2 border border-slate-700/50">
                          <p className="text-[9.5px] text-slate-500 font-sans">Resolved Landmark</p>
                          <p className="font-bold text-white truncate">{sel.placeLabel}</p>
                        </div>
                        <div className="rounded-lg bg-slate-800/60 p-2 border border-slate-700/50">
                          <p className="text-[9.5px] text-slate-500 font-sans">Impact Buffer</p>
                          <p className="font-bold text-blue-300">
                            ~{sel.severity === "critical" ? "2.2 km" : sel.severity === "high" ? "1.4 km" : "850 m"}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800 font-mono text-xs text-blue-400 flex items-center justify-between">
                        <span>{sel.lat.toFixed(5)}° N, {sel.lon.toFixed(5)}° E</span>
                        <span className="text-[9px] text-slate-500 uppercase">GPS Lock</span>
                      </div>
                    </div>

                    {/* Extracted Time Entities */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1.5">
                      <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Extracted Time Reference
                      </p>
                      <p className="text-xs font-semibold text-slate-200">
                        {sel.timeRefs && sel.timeRefs.length > 0 ? (
                          <span className="rounded bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-amber-200">
                            &quot;{sel.timeRefs.join("&quot;, &quot;")}&quot;
                          </span>
                        ) : (
                          <span className="text-slate-400">Extracted from event timeline</span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Incident opened: {new Date(sel.openedAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Summary & Multimodal Evidence */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
                      <p className="text-xs font-bold text-slate-300">LLM Narrative &amp; Citizen Evidence</p>
                      <p className="text-xs leading-relaxed text-slate-300 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                        {sel.summary}
                      </p>

                      {sel.mismatchReason && (
                        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-2.5 text-[11px] text-rose-200 space-y-1">
                          <p className="font-bold flex items-center gap-1 text-rose-300">
                            <span>⚠️</span> Multimodal Vision Discrepancy Flagged
                          </p>
                          <p className="text-[10.5px] leading-snug">{sel.mismatchReason}</p>
                        </div>
                      )}

                      {sel.photo && (
                        <div className="overflow-hidden rounded-lg border border-slate-700">
                          <img src={sel.photo} alt="Scene verification snapshot" className="h-32 w-full object-cover" />
                        </div>
                      )}
                    </div>

                    {/* Advisory */}
                    {sel.advisory && (
                      <div className="rounded-xl border border-blue-900/50 bg-blue-950/20 p-3.5 space-y-1.5">
                        <p className="text-xs font-bold text-blue-300">Multimodal Transit Advisory</p>
                        <p className="text-xs font-medium text-slate-200">{sel.advisory.headline}</p>
                        {sel.advisory.busNote && (
                          <p className="text-[11px] text-slate-400">🚌 {sel.advisory.busNote}</p>
                        )}
                        {sel.advisory.metroNote && (
                          <p className="text-[11px] text-emerald-400 font-medium">🚇 {sel.advisory.metroNote}</p>
                        )}
                      </div>
                    )}

                    {/* Action */}
                    {sel.status === "open" && (
                      <button
                        type="button"
                        onClick={() => {
                          void resolve(sel.id, "Resolved via Spatial Visualizer");
                        }}
                        className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-emerald-900/30 hover:brightness-110 transition"
                      >
                        ✓ Mark Resolved &amp; Broadcast All-Clear
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-800/80 bg-[#0B0F19]/85 py-3 text-center text-[10px] font-semibold text-slate-600 backdrop-blur">
        CUMTA · Chennai One prototype — simulated real-time social stream, NLP incident detection &amp; geo-targeted commuter alerts
      </footer>
    </div>
  );
}
