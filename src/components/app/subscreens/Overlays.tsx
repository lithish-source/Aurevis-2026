"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-store";
import { OverlayShell } from "@/components/app/OverlayShell";
import { EXPLORE_PLACES, EMERGENCY_NUMBERS, TRUSTED_CONTACTS, USER_LOCATION } from "@/lib/transit-data";
import { PLACE_ART, QrPattern } from "@/components/app/Art";
import { reportSos, reportTicket } from "@/lib/reporting";
import { cn } from "@/lib/utils";

// ─── QR scanner (BUS QR) ─────────────────────────────────────────────────────

const OTP_DIGITS = 4;

export function QrScanOverlay() {
  const { closeOverlay, setTab } = useApp();
  const [phase, setPhase] = useState<"scan" | "otp" | "book" | "done">("scan");
  const [otp, setOtp] = useState<string[]>(Array(OTP_DIGITS).fill(""));
  const [passengers, setPassengers] = useState(1);
  const [paying, setPaying] = useState(false);

  // simulated scan success
  useEffect(() => {
    if (phase !== "scan") return;
    const t = setTimeout(() => setPhase("otp"), 3400);
    return () => clearTimeout(t);
  }, [phase]);

  const otpComplete = otp.every((d) => d !== "");

  const handleOtp = (val: string, idx: number) => {
    const next = [...otp];
    next[idx] = val.replace(/\D/g, "").slice(-1);
    setOtp(next);
    if (val && idx < OTP_DIGITS - 1) {
      const el = document.getElementById(`otp-${idx + 1}`);
      el?.focus();
    }
  };

  const pay = () => {
    setPaying(true);
    // report the ticket purchase to the DB (local + Supabase), then confirm
    reportTicket({
      mode: "bus",
      routeNo: "21G",
      from: "Guindy",
      to: "Tambaram Sanatorium",
      passengers,
      fare: passengers * 25,
    }).finally(() => {
      setPaying(false);
      setPhase("done");
    });
  };

  return (
    <OverlayShell title="Bus QR Ticket" onClose={closeOverlay} headerClass="bg-[#12233B] text-white">
      {phase === "scan" && (
        <div className="flex h-full flex-col items-center bg-[#0D1B2A] px-6 pt-6">
          <p className="text-center text-[13px] font-medium text-sky-200/80">
            Align the QR sticker inside the frame
          </p>
          {/* viewfinder */}
          <div className="relative mt-6 aspect-square w-full max-w-[260px]">
            <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-[5px] border-t-[5px] border-[#2FE888]" />
            <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-[5px] border-t-[5px] border-[#2FE888]" />
            <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-[5px] border-l-[5px] border-[#2FE888]" />
            <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-[5px] border-r-[5px] border-[#2FE888]" />
            {/* fake sticker */}
            <div className="absolute inset-8 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/95 p-4 opacity-90">
              <QrPattern seed={99} size={120} />
              <span className="text-[10px] font-bold text-slate-700">MTC · SCAN &amp; BOOK</span>
              <span className="text-[8.5px] text-slate-400">Route 21G · Reg TN-01-B-5542</span>
            </div>
            {/* scanline */}
            <span
              className="absolute left-3 right-3 h-[3px] rounded-full bg-[#2FE888] shadow-[0_0_18px_4px_rgba(47,232,136,0.55)]"
              style={{ animation: "scanline 2.1s ease-in-out infinite" }}
            />
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#2FE888]" />
            <span className="text-[11.5px] font-semibold text-sky-100">Detecting code…</span>
          </div>
          <p className="mt-auto pb-8 text-center text-[10.5px] leading-relaxed text-sky-200/50">
            Every MTC bus carries a QR sticker near the door and inside near the poles.
          </p>
        </div>
      )}

      {phase === "otp" && (
        <div className="px-5 pt-6">
          <div className="rounded-[22px] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <div>
                <p className="text-[14.5px] font-bold text-slate-900">Bus detected</p>
                <p className="text-[11.5px] text-slate-500">Route 21G · GST Road Express</p>
              </div>
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-slate-600">
              Enter the <span className="font-bold">4-digit OTP</span> printed on the sticker inside the bus to confirm.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              {otp.map((d, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={d}
                  onChange={(e) => handleOtp(e.target.value, i)}
                  className="h-14 w-12 rounded-xl border-2 border-slate-200 text-center font-mono text-[22px] font-bold text-slate-800 outline-none transition focus:border-[#1A56DB]"
                  aria-label={`OTP digit ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <button
            disabled={!otpComplete}
            onClick={() => setPhase("book")}
            className={cn(
              "mt-5 w-full rounded-2xl py-3.5 text-[14px] font-bold transition active:scale-[0.98]",
              otpComplete ? "bg-[#1A56DB] text-white shadow-lg shadow-blue-900/20" : "bg-slate-200 text-slate-400"
            )}
          >
            Verify OTP
          </button>
        </div>
      )}

      {phase === "book" && (
        <div className="px-5 pt-6">
          <div className="rounded-[22px] bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Journey</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[14px] font-bold text-slate-900">Guindy</span>
              <span className="flex-1 border-t-2 border-dotted border-slate-300" />
              <span className="text-[14px] font-bold text-slate-900">Tambaram Sanatorium</span>
            </div>

            <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Passengers</p>
            <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <button
                onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[18px] font-bold text-slate-600 transition active:scale-90"
                aria-label="Remove passenger"
              >
                −
              </button>
              <span className="text-[16px] font-extrabold text-slate-900">{passengers}</span>
              <button
                onClick={() => setPassengers((p) => Math.min(6, p + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A56DB] text-[18px] font-bold text-white transition active:scale-90"
                aria-label="Add passenger"
              >
                +
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl bg-[#F1F3F6] px-4 py-3">
              <span className="text-[12.5px] font-semibold text-slate-600">Total fare</span>
              <span className="text-[18px] font-extrabold text-slate-900">₹{passengers * 25}</span>
            </div>
          </div>

          <button
            onClick={pay}
            disabled={paying}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E53935] py-3.5 text-[14px] font-bold text-white shadow-lg shadow-rose-900/20 transition active:scale-[0.98] disabled:opacity-70"
          >
            {paying ? (
              <>
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 animate-spin" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Paying via UPI…
              </>
            ) : (
              <>Pay ₹{passengers * 25} with UPI</>
            )}
          </button>
          <p className="mt-3 text-center text-[10.5px] text-slate-400">Powered by Chennai One payments · PCI-DSS secure</p>
        </div>
      )}

      {phase === "done" && (
        <div className="flex h-full flex-col items-center px-6 pt-10">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <h2 className="mt-4 text-[20px] font-extrabold text-slate-900">Ticket booked!</h2>
          <p className="mt-1 text-center text-[12.5px] text-slate-500">
            ₹{passengers * 25} paid · {passengers} passenger{passengers > 1 ? "s" : ""}
          </p>
          <div className="mt-6 w-full rounded-[26px] bg-white p-5 shadow-lg">
            <div className="rounded-2xl border-[6px] border-[#1F3F66]/90 p-1.5">
              <QrPattern seed={123} size={200} className="mx-auto" />
            </div>
            <p className="mt-3 text-center font-mono text-[13px] font-bold tracking-widest text-slate-800">MTB-9104-7731</p>
            <p className="mt-1 text-center text-[10.5px] text-slate-400">Valid for 60 minutes · Guindy → Tambaram Sanatorium</p>
          </div>
          <button
            onClick={() => setTab("tickets")}
            className="mt-6 w-full rounded-2xl bg-[#1A56DB] py-3.5 text-[14px] font-bold text-white shadow-lg shadow-blue-900/20 transition active:scale-[0.98]"
          >
            View my tickets
          </button>
          <button onClick={closeOverlay} className="mt-3 text-[12.5px] font-semibold text-slate-500">
            Done
          </button>
        </div>
      )}
    </OverlayShell>
  );
}

// ─── Safety / SOS ────────────────────────────────────────────────────────────

export function SafetyOverlay() {
  const { closeOverlay } = useApp();
  const [sosActive, setSosActive] = useState(false);
  const [shareLive, setShareLive] = useState(true);
  const [autoCall, setAutoCall] = useState(false);

  return (
    <OverlayShell title="Safety" onClose={closeOverlay} headerClass="bg-white text-slate-900">
      <div className="px-4 pb-8 pt-4">
        {/* SOS button */}
        <div className="flex flex-col items-center rounded-[26px] bg-gradient-to-b from-[#B71C1C] to-[#7F0000] px-6 py-8 text-white shadow-lg">
          <button
            onClick={() => {
              setSosActive((s) => {
                const next = !s;
                reportSos(next ? "sos_pressed" : "sos_cancelled", USER_LOCATION.lat, USER_LOCATION.lon);
                return next;
              });
            }}
            aria-pressed={sosActive}
            className={cn(
              "relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/60 bg-[#E53935] text-[26px] font-extrabold tracking-wide shadow-2xl transition active:scale-95",
              sosActive && "animate-pulse"
            )}
          >
            {!sosActive && <span className="absolute inset-0 animate-ping rounded-full bg-[#E53935]/40" style={{ animationDuration: "1.6s" }} />}
            SOS
          </button>
          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-rose-100">
            {sosActive
              ? "Alert sent. Sharing live location with your trusted contacts and the nearest police control room."
              : "Press in an emergency. We'll share your live location and trip details instantly."}
          </p>
        </div>

        {/* toggles */}
        <div className="mt-5 overflow-hidden rounded-[22px] bg-white shadow-sm">
          {[
            {
              label: "Share live location",
              sub: "During bus & metro trips",
              value: shareLive,
              set: setShareLive,
            },
            {
              label: "Auto-call helpline",
              sub: "Call 112 three seconds after SOS",
              value: autoCall,
              set: setAutoCall,
            },
          ].map((t, i) => (
            <div key={t.label} className={cn("flex items-center gap-3 px-4 py-4", i > 0 && "border-t border-slate-100")}>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold text-slate-800">{t.label}</p>
                <p className="text-[11px] text-slate-400">{t.sub}</p>
              </div>
              {/* switch */}
              <button
                role="switch"
                aria-checked={t.value}
                onClick={() => t.set(!t.value)}
                className={cn("relative h-7 w-12 rounded-full transition-colors", t.value ? "bg-[#1E9E5A]" : "bg-slate-200")}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                    t.value ? "left-6" : "left-1"
                  )}
                />
              </button>
            </div>
          ))}
        </div>

        {/* trusted contacts */}
        <h3 className="mb-2.5 mt-5 text-[14.5px] font-bold text-slate-800">Trusted contacts</h3>
        <div className="flex flex-col gap-2.5">
          {TRUSTED_CONTACTS.map((c) => (
            <div key={c.name} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#A8D4F0] text-[14px] font-extrabold text-[#1F3F66]">
                {c.name.split(" ").map((w) => w[0]).join("")}
              </span>
              <div className="flex-1">
                <p className="text-[13.5px] font-bold text-slate-800">{c.name}</p>
                <p className="text-[11px] text-slate-400">
                  {c.relation} · {c.phone}
                </p>
              </div>
              <button aria-label={`Call ${c.name}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition active:scale-90">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.7.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.5.6 3.7.1.4 0 .8-.2 1l-2.3 2.1z" />
                </svg>
              </button>
            </div>
          ))}
          <button className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3.5 text-[12.5px] font-bold text-slate-500 transition active:scale-[0.98]">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add trusted contact
          </button>
        </div>

        {/* emergency numbers */}
        <h3 className="mb-2.5 mt-5 text-[14.5px] font-bold text-slate-800">Emergency numbers</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {EMERGENCY_NUMBERS.map((e) => (
            <div key={e.label} className="flex items-center gap-2.5 rounded-2xl bg-white p-3.5 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 font-mono text-[13px] font-extrabold text-rose-600">
                {e.number.slice(0, 3)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11.5px] font-bold text-slate-700">{e.label}</p>
                <p className="truncate font-mono text-[10.5px] text-slate-400">{e.number}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </OverlayShell>
  );
}

// ─── Explore ─────────────────────────────────────────────────────────────────

const CATEGORIES = ["Heritage", "Museum", "Park", "Beach", "Temple"] as const;

export function ExploreOverlay() {
  const { closeOverlay, exploreCategory, setExploreCategory, setSelectedPlace, openOverlay } = useApp();

  const places = EXPLORE_PLACES.filter((p) => p.category === exploreCategory);
  const other = EXPLORE_PLACES.filter((p) => p.category !== exploreCategory).slice(0, 3);

  return (
    <OverlayShell title="Explore Chennai" onClose={closeOverlay} headerClass="bg-white text-slate-900">
      <div className="px-4 pb-8 pt-3">
        {/* category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setExploreCategory(c)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-[12.5px] font-bold transition active:scale-95",
                exploreCategory === c ? "bg-[#5A6472] text-white shadow" : "border border-slate-200 bg-white text-slate-600"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* place cards */}
        <div className="mt-4 flex flex-col gap-4">
          {places.map((p) => {
            const Art = PLACE_ART[p.art] ?? PLACE_ART.fort;
            return (
              <button
                key={p.name}
                onClick={() => {
                  setSelectedPlace(p.name);
                  openOverlay("place");
                }}
                className="overflow-hidden rounded-[22px] bg-white text-left shadow-md transition active:scale-[0.98]"
              >
                <Art className="h-36 w-full" />
                <div className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-extrabold text-slate-900">{p.name}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-slate-500">{p.area}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{p.blurb}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="flex items-center justify-end gap-1 text-[12.5px] font-bold text-slate-800">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#F5A623]" fill="currentColor" aria-hidden>
                        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3l-6.1 3.3 1.4-6.8L2.2 9.1l6.9-.8z" />
                      </svg>
                      {p.rating}
                    </span>
                    <span className="mt-1 block text-[10.5px] font-medium text-slate-400">{p.distance} away</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* you may also like */}
        <h3 className="mb-2.5 mt-6 text-[14.5px] font-bold text-slate-800">You may also like</h3>
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {other.map((p) => {
            const Art = PLACE_ART[p.art] ?? PLACE_ART.fort;
            return (
              <button
                key={p.name}
                onClick={() => {
                  setSelectedPlace(p.name);
                  openOverlay("place");
                }}
                className="w-40 shrink-0 overflow-hidden rounded-[18px] bg-white text-left shadow-sm transition active:scale-[0.97]"
              >
                <Art className="h-20 w-full" />
                <div className="p-3">
                  <p className="truncate text-[12px] font-bold text-slate-800">{p.name}</p>
                  <p className="text-[10px] text-slate-400">{p.category} · {p.distance}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </OverlayShell>
  );
}

// ─── Search ──────────────────────────────────────────────────────────────────

type SearchResult = { type: "station" | "bus" | "place"; title: string; sub: string };

const ALL_RESULTS: SearchResult[] = [
  // Metro Stations
  { type: "station", title: "Central Metro", sub: "Metro · Interchange (Blue & Green)" },
  { type: "station", title: "Alandur", sub: "Metro · Interchange (Blue & Green)" },
  { type: "station", title: "Meenambakkam", sub: "Metro · Blue Line (near Airport)" },
  { type: "station", title: "Chennai Airport", sub: "Metro · Blue Line Terminus" },
  { type: "station", title: "Guindy", sub: "Metro Blue + Suburban + MTC Terminus" },
  { type: "station", title: "Egmore", sub: "Suburban Rail + Metro Green Line" },
  { type: "station", title: "Koyambedu / CMBT", sub: "Metro Green Line + Intercity Bus Stand" },
  { type: "station", title: "Vadapalani", sub: "Metro Green Line (Forum Vijaya Mall)" },
  { type: "station", title: "Thirumangalam", sub: "Metro Green Line (VR Mall)" },
  { type: "station", title: "Anna Nagar Tower", sub: "Metro · Green Line" },
  { type: "station", title: "Thousand Lights", sub: "Metro Blue Line · Anna Salai" },
  { type: "station", title: "Government Estate", sub: "Metro Blue Line · Omandurar" },
  { type: "station", title: "LIC", sub: "Metro Blue Line · Mount Road" },
  { type: "station", title: "Wimco Nagar", sub: "Metro Blue Line · North Chennai" },
  { type: "station", title: "St. Thomas Mount", sub: "Metro Green + MRTS + Suburban" },

  // Suburban & MRTS Stations
  { type: "station", title: "Tambaram", sub: "Southern Railway Suburban Terminus (TBM)" },
  { type: "station", title: "Tambaram Sanatorium", sub: "Suburban Rail · MEPZ (TBMS)" },
  { type: "station", title: "Chromepet", sub: "Suburban Rail · GST Road (CMP)" },
  { type: "station", title: "Pallavaram", sub: "Suburban Rail · GST Road (PV)" },
  { type: "station", title: "Mambalam", sub: "Suburban Rail · T. Nagar (MBM)" },
  { type: "station", title: "Chennai Beach", sub: "Suburban Rail + MRTS Hub (MSB)" },
  { type: "station", title: "Velachery MRTS", sub: "MRTS Terminus · 100 Ft Bypass Rd (VLCY)" },
  { type: "station", title: "Perungudi", sub: "MRTS · OMR IT Expressway (PRGD)" },
  { type: "station", title: "Thiruvanmiyur", sub: "MRTS + MTC Bus Terminus (TYMR)" },

  // MTC Bus Routes
  { type: "bus", title: "578 · Sriperumbudur Bus", sub: "Via Chennai - Bengaluru Hwy" },
  { type: "bus", title: "21G · GST Road Express", sub: "Broadway ↔ Tambaram via GST" },
  { type: "bus", title: "1A · Marina Beach Rider", sub: "Thiruvanmiyur ↔ Central via Kamarajar" },
  { type: "bus", title: "570 · OMR IT Expressway", sub: "CMBT ↔ Kelambakkam via Sholinganallur" },
  { type: "bus", title: "102 · OMR Express", sub: "Broadway ↔ Kelambakkam" },
  { type: "bus", title: "70 · 100 Feet Road", sub: "Avadi ↔ Tambaram via Vadapalani" },
  { type: "bus", title: "54 · Poonamallee Express", sub: "Broadway ↔ Poonamallee via Porur" },

  // Key Places & Hubs
  { type: "place", title: "Marina Beach", sub: "Beach · Kamarajar Salai · 3.9 km" },
  { type: "place", title: "Besant Nagar Beach (Elliot's)", sub: "Beach & Promenade · 6.8 km" },
  { type: "place", title: "T. Nagar Ranganathan Street", sub: "Shopping & Commercial Hub · 4.2 km" },
  { type: "place", title: "Kilambakkam (KCBT)", sub: "Kalaignar Centenary Bus Terminus · GST Road" },
  { type: "place", title: "Porur Junction", sub: "Mount-Poonamallee Road Hub" },
  { type: "place", title: "Kathipara Junction", sub: "Grand Interchange · Guindy" },
  { type: "place", title: "Phoenix Marketcity", sub: "Mall & Entertainment · Velachery" },
  { type: "place", title: "Fort St. George", sub: "Heritage · 3.2 km" },
  { type: "place", title: "Government Museum", sub: "Museum · Egmore · 2.4 km" },
];

function ResultIcon({ type }: { type: SearchResult["type"] }) {
  if (type === "station")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#1F3F66" aria-hidden>
        <path d="M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-1l1.7 3h-2.4L13.6 18h-3.2L8.7 21H6.3L8 18H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
      </svg>
    );
  if (type === "bus")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#B07818" aria-hidden>
        <path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1v2.2a1 1 0 0 1-2 0V18h-2.5v2.2a1 1 0 0 1-2 0V18H9v2.2a1 1 0 0 1-2 0V18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#C03A50" aria-hidden>
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

export function SearchOverlay() {
  const { closeOverlay, openOverlay, setPlannerMode } = useApp();
  const [q, setQ] = useState("");
  const results = ALL_RESULTS.filter(
    (r) => r.title.toLowerCase().includes(q.toLowerCase()) || r.sub.toLowerCase().includes(q.toLowerCase())
  );

  const handleSelect = (r: SearchResult) => {
    if (r.type === "place") {
      openOverlay("explore");
    } else if (r.type === "bus") {
      setPlannerMode("bus");
      openOverlay("planner");
    } else {
      setPlannerMode("metro");
      openOverlay("planner");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      handleSelect(results[0]);
    }
  };

  return (
    <OverlayShell title="Search Transit & Places" onClose={closeOverlay} headerClass="bg-white text-slate-900">
      <div className="px-4 pb-8 pt-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" fill="currentColor" aria-hidden>
              <path d="M10 3a7 7 0 1 0 4.24 12.56l4.1 4.1a1.2 1.2 0 0 0 1.7-1.7l-4.1-4.1A7 7 0 0 0 10 3zm0 2.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2z" />
            </svg>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stations, buses, landmarks…"
              aria-label="Search"
              className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-10 text-[13.5px] outline-none placeholder:text-slate-400 focus:border-[#E53935]/50 focus:ring-2 focus:ring-[#E53935]/15"
            />
            {q.length > 0 && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded-full bg-[linear-gradient(90deg,#D618E8_0%,#F0143C_48%,#F25C05_100%)] px-4 text-[13px] font-bold text-white shadow-md transition hover:brightness-105 active:scale-95"
            aria-label="Submit search"
          >
            Search
          </button>
        </form>

        {q.length === 0 && (
          <>
            <p className="mb-2.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Popular Destinations</p>
            <div className="flex flex-wrap gap-2">
              {["Central Metro", "Tambaram", "Velachery MRTS", "Airport", "Route 21G", "Marina Beach", "Alandur"].map((r) => (
                <button
                  key={r}
                  onClick={() => setQ(r)}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-slate-300 active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3.5 2" strokeLinecap="round" />
                  </svg>
                  {r}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 flex flex-col">
          {results.map((r) => (
            <button
              key={r.title}
              onClick={() => handleSelect(r)}
              className="flex items-center gap-3 border-b border-slate-100 py-3.5 text-left transition active:bg-slate-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <ResultIcon type={r.type} />
              </span>
              <span className="flex-1">
                <span className="block text-[13.5px] font-semibold text-slate-800">{r.title}</span>
                <span className="block text-[11px] text-slate-400">{r.sub}</span>
              </span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ))}
          {results.length === 0 && (
            <p className="mt-10 text-center text-[13px] text-slate-400">Nothing found for “{q}”</p>
          )}
        </div>
      </div>
    </OverlayShell>
  );
}

// ─── Metro booking ───────────────────────────────────────────────────────────

const METRO_FARE_STATIONS = [
  { name: "Wimco Nagar", fare: 10 },
  { name: "Central Metro", fare: 20 },
  { name: "Alandur", fare: 30 },
  { name: "Meenambakkam", fare: 40 },
  { name: "Airport", fare: 50 },
];

export function MetroBookingOverlay() {
  const { closeOverlay, setTab } = useApp();
  const [from, setFrom] = useState("Government Estate");
  const [to, setTo] = useState("Meenambakkam");
  const [passengers, setPassengers] = useState(1);
  const [trips, setTrips] = useState(1);
  const fare = 40 * passengers * trips;

  return (
    <OverlayShell
      title="Book Metro Ticket"
      onClose={closeOverlay}
      headerClass="bg-[#1F3F66] text-white"
      footer={
        <button
          onClick={() => {
            reportTicket({
              mode: "metro",
              routeNo: "BL-1",
              from,
              to,
              passengers,
              fare,
            }).finally(() => {
              setTab("tickets");
              closeOverlay();
            });
          }}
          className="w-full rounded-2xl bg-[#1A56DB] py-3.5 text-[14px] font-bold text-white shadow-lg shadow-blue-900/20 transition active:scale-[0.98]"
        >
          Pay ₹{fare} &amp; get QR ticket
        </button>
      }
    >
      <div className="px-4 pb-6 pt-4">
        <div className="rounded-[22px] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">From</p>
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {METRO_FARE_STATIONS.map((s) => (
              <button
                key={s.name}
                onClick={() => setFrom(s.name)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-[11.5px] font-bold transition active:scale-95",
                  from === s.name ? "bg-[#1F3F66] text-white" : "bg-slate-100 text-slate-600"
                )}
              >
                {s.name}
              </button>
            ))}
          </div>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">To</p>
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {METRO_FARE_STATIONS.map((s) => (
              <button
                key={s.name}
                onClick={() => setTo(s.name)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-[11.5px] font-bold transition active:scale-95",
                  to === s.name ? "bg-[#1F3F66] text-white" : "bg-slate-100 text-slate-600"
                )}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Passengers</p>
              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[16px] font-bold text-slate-600 active:scale-90"
                  aria-label="Remove passenger"
                >
                  −
                </button>
                <span className="text-[15px] font-extrabold text-slate-900">{passengers}</span>
                <button
                  onClick={() => setPassengers((p) => Math.min(6, p + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A56DB] text-[16px] font-bold text-white active:scale-90"
                  aria-label="Add passenger"
                >
                  +
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Trips</p>
              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={() => setTrips((t) => Math.max(1, t - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[16px] font-bold text-slate-600 active:scale-90"
                  aria-label="Remove trip"
                >
                  −
                </button>
                <span className="text-[15px] font-extrabold text-slate-900">{trips}</span>
                <button
                  onClick={() => setTrips((t) => Math.min(4, t + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A56DB] text-[16px] font-bold text-white active:scale-90"
                  aria-label="Add trip"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F1F3F6] px-4 py-3">
            <span className="text-[12.5px] font-semibold text-slate-600">
              {from} → {to}
            </span>
            <span className="text-[18px] font-extrabold text-slate-900">₹{fare}</span>
          </div>
        </div>

        <p className="mt-4 text-center text-[10.5px] leading-relaxed text-slate-400">
          QR tickets are valid for 60 minutes from purchase. Store them offline in My Tickets.
        </p>
      </div>
    </OverlayShell>
  );
}

// ─── Place detail ────────────────────────────────────────────────────────────

export function PlaceOverlay() {
  const { closeOverlay, openOverlay, selectedPlace } = useApp();
  const place = EXPLORE_PLACES.find((p) => p.name === selectedPlace) ?? EXPLORE_PLACES[0];
  const Art = PLACE_ART[place.art] ?? PLACE_ART.fort;

  return (
    <OverlayShell title={place.category} onClose={closeOverlay} headerClass="bg-white text-slate-900">
      <div className="pb-8">
        <Art className="h-44 w-full" />
        <div className="px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-extrabold text-slate-900">{place.name}</h2>
              <p className="mt-0.5 text-[12px] text-slate-500">{place.area}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#FDF1DE] px-2.5 py-1 text-[12px] font-bold text-[#8A5A12]">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3l-6.1 3.3 1.4-6.8L2.2 9.1l6.9-.8z" />
              </svg>
              {place.rating}
            </span>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{place.blurb}. Reachable by MTC bus and Chennai Metro; the nearest shared auto stand is a short walk from the main gate.</p>

          <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
            {[
              { v: place.distance, l: "From you" },
              { v: "06:00", l: "Opens" },
              { v: "18:30", l: "Closes" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-white p-3 shadow-sm">
                <p className="text-[14px] font-extrabold text-slate-900">{s.v}</p>
                <p className="mt-0.5 text-[10.5px] font-medium text-slate-400">{s.l}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => openOverlay("planner")}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E53935] py-3.5 text-[14px] font-bold text-white shadow-lg shadow-rose-900/20 transition active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zM14.5 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
            </svg>
            Directions via transit
          </button>
        </div>
      </div>
    </OverlayShell>
  );
}

// ─── Service detail ──────────────────────────────────────────────────────────

export function ServiceDetailOverlay() {
  const { closeOverlay, selectedService } = useApp();

  return (
    <OverlayShell title={selectedService ?? "Service"} onClose={closeOverlay} headerClass="bg-white text-slate-900">
      <div className="px-4 pb-8 pt-4">
        <div className="rounded-[22px] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1A56DB]/10 text-[20px]">🏢</span>
            <div>
              <p className="text-[15.5px] font-extrabold text-slate-900">{selectedService}</p>
              <p className="text-[11.5px] text-slate-500">Greater Chennai Corporation</p>
            </div>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-slate-600">
            Access, apply and make payments for {selectedService?.toLowerCase()} services online. Documents are issued
            digitally to your Chennai One profile and can be shown anywhere in Tamil Nadu.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          {[
            { icon: "📋", label: "New application", sub: "Apply online in 5 minutes" },
            { icon: "🔍", label: "Check status", sub: "Track your request" },
            { icon: "💳", label: "Make a payment", sub: "UPI, cards & netbanking" },
            { icon: "📥", label: "Download certificate", sub: "Digitally signed PDF" },
          ].map((a) => (
            <button key={a.label} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition active:scale-[0.98]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[18px]">{a.icon}</span>
              <span className="flex-1">
                <span className="block text-[13.5px] font-bold text-slate-800">{a.label}</span>
                <span className="block text-[11px] text-slate-400">{a.sub}</span>
              </span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-[#FDF1DE] p-4 text-[11.5px] leading-relaxed text-[#8A5A12]">
          For grievances about this service, call the GCC helpline <span className="font-bold">1913</span> (toll-free, 24×7) or
          raise it from the Services tab.
        </div>
      </div>
    </OverlayShell>
  );
}
