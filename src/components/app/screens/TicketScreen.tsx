"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-store";
import { ACTIVE_TICKET, TICKET_HISTORY } from "@/lib/transit-data";
import { getStoredTickets, type StoredTicket } from "@/lib/reporting";
import { QrPattern } from "@/components/app/Art";
import { cn } from "@/lib/utils";

function ModeIcon({ mode, className = "h-5 w-5" }: { mode: string; className?: string }) {
  if (mode === "metro")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-1l1.7 3h-2.4L13.6 18h-3.2L8.7 21H6.3L8 18H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm1 3v6h8V6H8z" />
      </svg>
    );
  if (mode === "pass")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18M8 13h4" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1v2.2a1 1 0 0 1-2 0V18h-2.5v2.2a1 1 0 0 1-2 0V18H9v2.2a1 1 0 0 1-2 0V18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1 3v6h12V6H6z" />
    </svg>
  );
}

const BOOK_MODES = [
  { id: "bus", label: "Bus", circle: "bg-[#FBE18C] text-[#7A4E1D]" },
  { id: "metro", label: "Metro", circle: "bg-[#A8D4F0] text-[#1F3F66]" },
  { id: "pass", label: "Passes", circle: "bg-[#BFD8B8] text-[#1E6B34]" },
] as const;

function issuedTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "Just now";
  }
}

/** Big QR ticket card used for the latest purchase (or the sample ticket). */
function ActiveTicketCard({ ticket, synced }: { ticket: StoredTicket; synced: boolean }) {
  const seed = Number(ticket.ref.replace(/\D/g, "").slice(-4)) || 42;
  return (
    <div className="relative overflow-hidden rounded-[26px] bg-white shadow-lg shadow-slate-900/10">
      <div className="bg-gradient-to-r from-[#1F3F66] to-[#3B67AF] px-5 pb-8 pt-4 text-white">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide opacity-90">
            <ModeIcon mode={ticket.mode} className="h-4 w-4" />
            {ticket.mode === "metro" ? "CHENNAI METRO · QR TICKET" : `MTC BUS ${ticket.routeNo ?? ""} · QR TICKET`}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            VALID
          </span>
        </div>
        <p className="mt-3 text-[19px] font-extrabold leading-tight">
          {ticket.from} <span className="opacity-60">→</span> {ticket.to}
        </p>
        <p className="mt-0.5 text-[11.5px] opacity-80">
          {ticket.passengers} passenger{ticket.passengers > 1 ? "s" : ""} · ₹{ticket.fare} · Issued {issuedTime(ticket.issuedAt)}
        </p>
      </div>

      {/* perforation */}
      <div className="relative">
        <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-[#F5F5F4]" />
        <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-[#F5F5F4]" />
        <div className="border-t-2 border-dashed border-slate-200" />
      </div>

      {/* QR body */}
      <div className="flex flex-col items-center px-5 py-5">
        <div className="rounded-2xl border-[6px] border-[#1F3F66]/90 p-1.5">
          <QrPattern seed={seed} size={168} />
        </div>
        <p className="mt-3 font-mono text-[13px] font-bold tracking-widest text-slate-800">{ticket.ref}</p>
        <p className="mt-1 text-[10.5px] text-slate-400">Valid for 60 minutes · Show at the gate scanner</p>
        <span
          className={cn(
            "mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold",
            synced ? "bg-[#EAF7EE] text-[#1F9D4D]" : "bg-amber-50 text-[#B07818]"
          )}
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {synced ? "Saved to your account · synced" : "Saved to local database"}
        </span>
      </div>
    </div>
  );
}

export function TicketScreen() {
  const { openOverlay, setTab: setAppTab } = useApp();
  const [tab, setTab] = useState<"active" | "history">("active");
  const [tickets, setTickets] = useState<StoredTicket[]>([]);

  useEffect(() => {
    const refresh = () => setTickets(getStoredTickets());
    refresh();
    window.addEventListener("chennai-one:tickets-changed", refresh);
    return () => window.removeEventListener("chennai-one:tickets-changed", refresh);
  }, []);

  const latest = tickets[0];
  const fallbackTicket: StoredTicket = {
    id: "static",
    ref: ACTIVE_TICKET.id,
    mode: ACTIVE_TICKET.mode,
    routeNo: null,
    from: ACTIVE_TICKET.from,
    to: ACTIVE_TICKET.to,
    passengers: ACTIVE_TICKET.passengers,
    fare: ACTIVE_TICKET.fare,
    issuedAt: new Date().toISOString(),
    synced: false,
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-40 pt-4">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">My Tickets</h1>
          <p className="text-[12px] text-slate-500">One QR for bus & metro travel</p>
        </div>
        <button
          onClick={() => openOverlay("qrScan")}
          className="flex items-center gap-1.5 rounded-full bg-[#1A56DB] px-3.5 py-2 text-[12px] font-bold text-white shadow-md shadow-blue-900/20 transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
          </svg>
          Scan & Book
        </button>
      </header>

      {/* tabs */}
      <div className="mb-4 flex rounded-full bg-slate-100 p-1">
        {(["active", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-full py-2 text-[12.5px] font-bold capitalize transition",
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            )}
          >
            {t === "active" ? "Active ticket" : `History${tickets.length ? ` · ${tickets.length}` : ""}`}
          </button>
        ))}
      </div>

      {tab === "active" ? (
        <>
          <ActiveTicketCard ticket={latest ?? fallbackTicket} synced={Boolean(latest?.synced)} />

          {/* earlier purchases today */}
          {tickets.length > 1 && (
            <>
              <h2 className="mb-2.5 mt-5 text-[13px] font-bold text-slate-500">Earlier today</h2>
              <div className="flex flex-col gap-2">
                {tickets.slice(1).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <ModeIcon mode={t.mode} className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-slate-800">
                        {t.mode === "metro" ? "Metro" : `Bus ${t.routeNo ?? ""}`} · {t.from} → {t.to}
                      </p>
                      <p className="text-[10.5px] text-slate-500">
                        {t.passengers} pax · ₹{t.fare} · {issuedTime(t.issuedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] text-slate-400">{t.ref}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* quick book */}
          <h2 className="mb-3 mt-6 text-[15px] font-bold text-slate-800">Quick book</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {BOOK_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  if (m.id === "pass") setAppTab("pass");
                  else openOverlay(m.id === "metro" ? "metroBooking" : "busBooking");
                }}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white py-4 shadow-sm transition active:scale-95"
              >
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", m.circle)}>
                  <ModeIcon mode={m.id} />
                </span>
                <span className="text-[12px] font-bold text-slate-700">{m.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => openOverlay("qrScan")}
            className="mt-3 w-full rounded-2xl bg-[#FDF1DE] p-3.5 text-left text-[12px] font-medium text-[#8A5A12] transition active:scale-[0.98]"
          >
            💡 Tip: Scan the QR sticker inside MTC buses to buy a ticket without cash.
          </button>
        </>
      ) : (
        /* ── history: purchases from the database first, then the sample ── */
        <div className="flex flex-col gap-3">
          {tickets.map((t) => (
            <div key={`h-${t.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ModeIcon mode={t.mode} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-slate-800">
                  {t.mode === "metro" ? "Metro" : `Bus ${t.routeNo ?? ""}`} · {t.from} → {t.to}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t.passengers} passenger{t.passengers > 1 ? "s" : ""} · Today
                  {t.synced ? " · synced ✓" : ""}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-400">{t.ref}</p>
              </div>
              <span className="shrink-0 text-[15px] font-extrabold text-slate-800">₹{t.fare}</span>
            </div>
          ))}
          {TICKET_HISTORY.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <ModeIcon mode={t.mode} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-slate-800">{t.title}</p>
                <p className="text-[11px] text-slate-500">{t.sub} · {t.date}</p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-400">{t.id}</p>
              </div>
              <span className="shrink-0 text-[15px] font-extrabold text-slate-800">₹{t.fare}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
