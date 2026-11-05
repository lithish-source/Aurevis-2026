"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-store";
import {
  clearStoredData,
  getDeviceId,
  getStoredUser,
  reportEvent,
  sendTestEvent,
  setStoredUser,
  type StoredUser,
} from "@/lib/reporting";
import { TriangleLogo } from "@/components/app/TriangleLogo";
import { cn } from "@/lib/utils";

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const QUICK_LINKS = [
  { label: "City Services", sub: "GCC bills & certificates", overlay: "services" as const, icon: "grid" },
  { label: "Explore Chennai", sub: "Heritage, parks & museums", overlay: "explore" as const, icon: "compass" },
  { label: "Live Tracking", sub: "Buses & metro in real time", overlay: "liveTracking" as const, icon: "live" },
  { label: "Safety", sub: "SOS & trusted contacts", overlay: "safety" as const, icon: "shield" },
];

function QuickLinkIcon({ name }: { name: string }) {
  if (name === "grid")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <circle cx="6" cy="6" r="2.1" />
        <circle cx="12" cy="6" r="2.1" />
        <circle cx="18" cy="6" r="2.1" />
        <circle cx="6" cy="12" r="2.1" />
        <circle cx="12" cy="12" r="2.1" />
        <circle cx="18" cy="12" r="2.1" />
        <circle cx="6" cy="18" r="2.1" />
        <circle cx="12" cy="18" r="2.1" />
        <circle cx="18" cy="18" r="2.1" />
      </svg>
    );
  if (name === "compass")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.5 5.5-2.6 6.4-6.4 2.6 2.6-6.4 6.4-2.6zM12 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
      </svg>
    );
  if (name === "live")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2.5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M12 2l8 3.5V11c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5.5L12 2z" />
    </svg>
  );
}

// ─── data & sync diagnostics ─────────────────────────────────────────────────

type StatusResponse = {
  ok: boolean;
  local: Record<string, number>;
  supabase: {
    configured: boolean;
    url: string | null;
    reachable: boolean | null;
    error?: string;
    counts: Record<string, number | null> | null;
  };
  recentSync: { table: string; status: string; detail: string | null; at: string }[];
};

function SyncDot({ state }: { state: "ok" | "warn" | "off" }) {
  return (
    <span
      className={cn(
        "relative flex h-2 w-2",
        state === "ok" && "text-emerald-500",
        state === "warn" && "text-amber-500",
        state === "off" && "text-slate-300"
      )}
    >
      {state === "ok" && <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400/60" />}
      <span className="relative h-2 w-2 rounded-full bg-current" />
    </span>
  );
}

function DataSyncCard() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/report/status")
      .then((r) => r.json())
      .then((d) => d.ok && setStatus(d))
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const sbState: "ok" | "warn" | "off" = !status?.supabase.configured
    ? "off"
    : status.supabase.reachable
      ? "ok"
      : "warn";

  const runTest = async () => {
    setTesting(true);
    setTestMsg(null);
    const res = await sendTestEvent();
    setTestMsg(res.message ?? "Done");
    setTesting(false);
    load();
  };

  return (
    <section className="mt-5">
      <h2 className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wider text-slate-400">Data & sync</h2>
      <div className="overflow-hidden rounded-[20px] bg-white shadow-sm">
        {/* local db row */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden>
              <ellipse cx="12" cy="5.5" rx="8" ry="3" />
              <path d="M4 5.5V12c0 1.66 3.58 3 8 3s8-1.34 8-3V5.5c0 1.66-3.58 3-8 3s-8-1.34-8-3z" />
              <path d="M4 11.5V18c0 1.66 3.58 3 8 3s8-1.34 8-3v-6.5c0 1.66-3.58 3-8 3s-8-1.34-8-3z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-800">Local database</p>
            <p className="text-[11px] text-slate-400">
              {status
                ? `${status.local.app_users} users · ${status.local.ticket_purchases} tickets · ${status.local.pass_purchases} passes · ${status.local.analytics_events} events`
                : "Checking…"}
            </p>
          </div>
          <SyncDot state="ok" />
        </div>

        {/* supabase row */}
        <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#24BE70]/10 text-[#24BE70]">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4.5 12.5l5-5c1.5-1.5 3.5-1.5 5 0s1.5 3.5 0 5l-7 7c-1 1-2.5 1-3.5 0s-1-2.5 0-3.5l6.5-6.5" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-800">Supabase mirror</p>
            <p className="truncate text-[11px] text-slate-400">
              {status?.supabase.configured
                ? status.supabase.reachable
                  ? `${status.supabase.url?.replace(/^https?:\/\//, "")} · ${status.supabase.counts?.ticket_purchases ?? 0} tickets mirrored`
                  : `Unreachable${status.supabase.error ? ` · ${status.supabase.error.slice(0, 40)}` : ""}`
                : "Not configured — add SUPABASE_URL & SUPABASE_KEY to .env"}
            </p>
          </div>
          <SyncDot state={sbState} />
        </div>

        {/* last sync rows */}
        {status?.recentSync?.length ? (
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Recent writes</p>
            <div className="flex flex-col gap-1">
              {status.recentSync.slice(0, 4).map((s, i) => (
                <p key={i} className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                  {s.status === "ok" ? (
                    <CheckIcon className="h-3 w-3 text-emerald-500" />
                  ) : s.status === "skipped" ? (
                    <span className="h-3 w-3 rounded-full bg-slate-200 text-[7px] font-bold leading-3 text-center text-slate-500">–</span>
                  ) : (
                    <span className="h-3 w-3 rounded-full bg-rose-400 text-[7px] font-bold leading-3 text-center text-white">!</span>
                  )}
                  {s.table.replace(/_/g, " ")} · {s.status}
                  <span className="text-slate-300">
                    {new Date(s.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                  </span>
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {/* test button */}
        <div className="border-t border-slate-100 px-4 py-3">
          <button
            onClick={runTest}
            disabled={testing}
            className="w-full rounded-xl bg-slate-100 py-2.5 text-[12px] font-bold text-slate-700 transition active:scale-[0.98] disabled:opacity-60"
          >
            {testing ? "Sending test event…" : "Send test event → verify data transfer"}
          </button>
          {testMsg && <p className="mt-2 text-[10.5px] leading-snug text-slate-500">{testMsg}</p>}
        </div>
      </div>
    </section>
  );
}

// ─── sign-up form (no account yet) ───────────────────────────────────────────

function SignUpCard({ onDone }: { onDone: (u: StoredUser) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/report/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), deviceId: getDeviceId() }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok && json.user) {
      const u: StoredUser = {
        id: json.user.id,
        name: json.user.name,
        phone: json.user.phone,
        email: json.user.email,
        deviceId: json.user.deviceId,
      };
      setStoredUser(u);
      reportEvent("account_created", { name: u.name });
      onDone(u);
    } else {
      setError(json.error ?? "Could not create account");
    }
  };

  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <TriangleLogo className="h-11 w-11" />
        <div>
          <p className="text-[15px] font-bold text-slate-900">Create your account</p>
          <p className="text-[11px] text-slate-500">Sync tickets, passes & SOS across Chennai One</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          aria-label="Full name"
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13.5px] font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1A56DB] focus:bg-white"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (e.g. 98407 11223)"
          aria-label="Phone number"
          inputMode="tel"
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13.5px] font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1A56DB] focus:bg-white"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          aria-label="Email"
          inputMode="email"
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13.5px] font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1A56DB] focus:bg-white"
        />
      </div>

      {error && <p className="mt-2 text-[11px] font-semibold text-rose-500">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="mt-4 w-full rounded-2xl bg-[#1A56DB] py-3 text-[13.5px] font-bold text-white shadow-lg shadow-blue-900/20 transition active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Creating account…" : "Create account & sync"}
      </button>
      <p className="mt-2.5 text-center text-[10px] leading-snug text-slate-400">
        Your account is stored in the app database and mirrored to Supabase when configured.
      </p>
    </div>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

type Summary = {
  stats: { trips: number; spent: number; sosCount: number };
  tickets: { id: string; ref: string; mode: string; fromStop: string; toStop: string; fare: number; createdAt: string }[];
  passes: { id: string; name: string; price: number; validity: string; createdAt: string }[];
};

const MENU = [
  {
    group: "Account",
    items: [
      { label: "Personal details", sub: "Name, phone, email" },
      { label: "Saved places", sub: "Home, Work & favourites" },
      { label: "Payment methods", sub: "UPI · 1 card" },
    ],
  },
  {
    group: "Travel",
    items: [
      { label: "My passes", sub: "Travel passes & QR", action: "pass" as const },
      { label: "Travel history", sub: "Tickets from the database", action: "tickets" as const },
      { label: "Safety settings", sub: "Trusted contacts & SOS", action: "safety" as const },
    ],
  },
  {
    group: "Support",
    items: [
      { label: "Help & FAQ" },
      { label: "Report an issue" },
      { label: "About Chennai One", sub: "Version 3.6.1 · triangle", action: "about" as const },
    ],
  },
];

export function ProfileScreen() {
  const { openOverlay, setTab } = useApp();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    // deferred so hydration completes with the null default first
    const t = setTimeout(() => setUser(getStoredUser()), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`/api/account/summary?deviceId=${encodeURIComponent(user.deviceId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setSummary(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const initials = (user?.name ?? "")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="h-full overflow-y-auto px-4 pb-40 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#111]">Account</h1>
          <p className="text-[12.5px] text-[#6B7280]">Your Chennai One profile & services</p>
        </div>
        <TriangleLogo className="h-9 w-9 rounded-xl" />
      </header>

      {!user ? (
        /* ── signed out: account option ── */
        <SignUpCard onDone={setUser} />
      ) : (
        /* ── profile card ── */
        <div className="flex items-center gap-4 rounded-[24px] bg-white p-5 shadow-sm">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#E53935] to-[#F4511E] text-[22px] font-extrabold text-white">
            {initials || "AR"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold text-slate-900">{user.name}</p>
            <p className="text-[12px] text-slate-500">{user.phone ? `+91 ${user.phone.replace(/\s/g, "")}` : user.email}</p>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#EAF7EE] px-2.5 py-0.5 text-[10px] font-bold text-[#166B3F]">
              <CheckIcon className="h-2.5 w-2.5" />
              Verified · Chennai One ID
            </span>
          </div>
          <button aria-label="Edit profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition active:scale-95">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden>
              <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </button>
        </div>
      )}

      {/* ── quick links ── */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {QUICK_LINKS.map((q) => (
          <button
            key={q.label}
            onClick={() => openOverlay(q.overlay)}
            className="flex items-center gap-2.5 rounded-[20px] bg-white p-3 text-left shadow-[0_3px_14px_rgba(17,17,17,0.06)] transition active:scale-[0.97]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1A6FE0]/10 text-[#1A6FE0]">
              <QuickLinkIcon name={q.icon} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-bold text-[#111]">{q.label}</span>
              <span className="block truncate text-[9.5px] text-[#8E8E93]">{q.sub}</span>
            </span>
          </button>
        ))}
      </div>

      {/* ── stats (from the database) ── */}
      <div className="mt-2.5 grid grid-cols-3 gap-2.5">
        {[
          { v: summary ? String(summary.stats.trips) : "…", l: "Trips" },
          { v: summary ? `₹${summary.stats.spent}` : "…", l: "Spent" },
          { v: summary ? `${Math.max(1, summary.stats.trips)} kg` : "…", l: "CO₂ saved" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <p className="text-[16px] font-extrabold text-slate-900">{s.v}</p>
            <p className="mt-0.5 text-[10.5px] font-medium text-slate-500">{s.l}</p>
          </div>
        ))}
      </div>

      {/* ── recent DB activity ── */}
      {summary && summary.tickets.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wider text-slate-400">Recent tickets (from DB)</h2>
          <div className="overflow-hidden rounded-[20px] bg-white shadow-sm">
            {summary.tickets.slice(0, 3).map((t, i) => (
              <div key={t.id} className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-slate-100")}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-extrabold text-slate-600">
                  {t.mode === "metro" ? "M" : "B"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-slate-800">
                    {t.fromStop} → {t.toStop}
                  </span>
                  <span className="block text-[10.5px] text-slate-400">
                    {t.ref} · {new Date(t.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-extrabold text-slate-700">₹{t.fare}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── data & sync diagnostics ── */}
      <DataSyncCard />

      {/* ── menu groups ── */}
      {MENU.map((g) => (
        <section key={g.group} className="mt-5">
          <h2 className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wider text-slate-400">{g.group}</h2>
          <div className="overflow-hidden rounded-[20px] bg-white shadow-sm">
            {g.items.map((item, idx) => (
              <button
                key={item.label}
                onClick={() => {
                  if ("action" in item && item.action === "safety") openOverlay("safety");
                  else if ("action" in item && item.action === "pass") setTab("pass");
                  else if ("action" in item && item.action === "tickets") setTab("tickets");
                }}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-slate-50 ${idx > 0 ? "border-t border-slate-100" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-800">
                    {item.label === "About Chennai One" && <TriangleLogo className="h-4.5 w-4.5 rounded-[4px]" mono />}
                    {item.label}
                  </span>
                  {item.sub && <span className="block text-[11px] text-slate-400">{item.sub}</span>}
                </span>
                <Chevron />
              </button>
            ))}
          </div>
        </section>
      ))}

      {user && (
        <button
          onClick={() => {
            clearStoredData();
            setStoredUser(null);
            setUser(null);
            setSummary(null);
          }}
          className="mt-6 w-full rounded-2xl border border-rose-200 bg-rose-50 py-3 text-[13px] font-bold text-rose-600 transition active:scale-[0.98]"
        >
          Log out
        </button>
      )}
      <p className="mt-3 pb-2 text-center text-[10px] text-slate-400">
        Chennai One · An initiative of CUMTA, Government of Tamil Nadu
      </p>
    </div>
  );
}
