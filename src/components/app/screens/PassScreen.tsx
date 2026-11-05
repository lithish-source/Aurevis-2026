"use client";

import { useEffect, useState } from "react";
import { TRAVEL_PASSES, type TravelPass } from "@/lib/transit-data";
import { getStoredPasses, reportPass, type StoredPass } from "@/lib/reporting";
import { QrPattern } from "@/components/app/Art";
import { cn } from "@/lib/utils";

function PassIcon({ icon, color }: { icon: TravelPass["icon"]; color: string }) {
  const common = "h-6 w-6";
  if (icon === "metro")
    return (
      <svg viewBox="0 0 24 24" className={common} fill={color} aria-hidden>
        <path d="M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-1l1.7 3h-2.4L13.6 18h-3.2L8.7 21H6.3L8 18H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm1 3v6h8V6H8z" />
      </svg>
    );
  if (icon === "bus")
    return (
      <svg viewBox="0 0 24 24" className={common} fill={color} aria-hidden>
        <path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1v2.2a1 1 0 0 1-2 0V18h-2.5v2.2a1 1 0 0 1-2 0V18H9v2.2a1 1 0 0 1-2 0V18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1 3v6h12V6H6z" />
      </svg>
    );
  if (icon === "student")
    return (
      <svg viewBox="0 0 24 24" className={common} fill={color} aria-hidden>
        <path d="M12 3 1.8 7.4 12 11.8l8.4-3.8v5.4a1 1 0 0 0 2 0V7.4L12 3zm-6 9.9v3.4c0 1.9 2.7 3.4 6 3.4s6-1.5 6-3.4v-3.4l-6 2.7-6-2.7z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={common} fill={color} aria-hidden>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 0 1 6.9 4H13v2h6.7a8 8 0 0 1 .3 2c0 .7-.1 1.4-.3 2H13v2h5.9A8 8 0 1 1 12 4zm-1 4v5l4.2 2.5 1-1.7-3.2-1.9V8h-2z" />
    </svg>
  );
}

export function PassScreen() {
  const [purchased, setPurchased] = useState<StoredPass[]>([]);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setPurchased(getStoredPasses());
    refresh();
    window.addEventListener("chennai-one:passes-changed", refresh);
    return () => window.removeEventListener("chennai-one:passes-changed", refresh);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const activePass = purchased[0];
  const activeDef = activePass
    ? TRAVEL_PASSES.find((p) => p.id === activePass.passId)
    : TRAVEL_PASSES.find((p) => p.active);
  const active = Boolean(activePass || activeDef);
  const activeColor = activeDef?.color ?? "#1A6FE0";
  const activeName = activePass?.name ?? activeDef?.name ?? "";
  const activeOperator = activeDef?.operator ?? "CUMTA · Chennai transit";
  const activeValidity = activePass?.validity ?? activeDef?.validity ?? "";
  const rest = TRAVEL_PASSES.filter((p) => p.id !== activeDef?.id);

  const buy = async (pass: TravelPass) => {
    setBuyingId(pass.id);
    const res = await reportPass({
      passId: pass.id,
      name: pass.name,
      price: pass.price,
      validity: pass.validity,
    });
    setBuyingId(null);
    setToast(
      res.ok
        ? `${pass.name} purchased · saved to your account${res.pass?.synced ? " ✓ synced" : ""}`
        : "Purchase recorded locally — check your connection"
    );
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-40 pt-4">
      <header className="mb-4">
        <h1 className="text-[22px] font-bold text-[#111]">Travel Passes</h1>
        <p className="text-[12.5px] text-[#6B7280]">One pass for every mode · powered by CUMTA</p>
      </header>

      {/* purchase toast */}
      {toast && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-[#EAF7EE] px-4 py-3 text-[12px] font-semibold text-[#166B3F] shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {toast}
        </div>
      )}

      {/* active pass */}
      {active && (
        <div className="mb-5 overflow-hidden rounded-[26px] bg-white shadow-[0_4px_18px_rgba(17,17,17,0.08)]">
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ background: `linear-gradient(90deg, ${activeColor}, ${activeColor}CC)` }}
          >
            <span className="text-[11px] font-extrabold tracking-[0.14em] text-white">ACTIVE PASS</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[9.5px] font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
              Valid
            </span>
          </div>
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
              <QrPattern seed={77} size={60} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15.5px] font-bold text-[#111]">{activeName}</p>
              <p className="mt-0.5 text-[11.5px] text-[#6B7280]">{activeOperator}</p>
              <p className="mt-1.5 text-[11px] font-semibold text-[#1F9D4D]">{activeValidity}</p>
              {activePass && <p className="text-[10px] text-[#8E8E93]">Purchased today · saved to your account</p>}
            </div>
          </div>
          <div className="border-t border-dashed border-slate-200 px-5 py-3">
            <p className="text-center text-[10px] text-[#8E8E93]">Show this QR at metro gates & bus readers</p>
          </div>
        </div>
      )}

      {/* available passes */}
      <h2 className="mb-3 text-[15px] font-bold text-[#111]">Buy a pass</h2>
      <div className="flex flex-col gap-3">
        {rest.map((pass) => (
          <div key={pass.id} className="flex items-center gap-3.5 rounded-[24px] bg-white p-4 shadow-[0_3px_14px_rgba(17,17,17,0.06)]">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${pass.color}14` }}
            >
              <PassIcon icon={pass.icon} color={pass.color} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-[#111]">{pass.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-[#6B7280]">{pass.operator}</p>
              <p className="mt-0.5 text-[10.5px] text-[#8E8E93]">{pass.validity}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-extrabold text-[#111]">₹{pass.price}</p>
              <button
                onClick={() => buy(pass)}
                disabled={buyingId === pass.id}
                className="mt-1 rounded-full bg-[#1A6FE0] px-3 py-1.5 text-[10.5px] font-bold text-white transition active:scale-95 disabled:opacity-60"
              >
                {buyingId === pass.id ? "Buying…" : "Buy"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 rounded-[20px] bg-white/70 p-4 text-center text-[10.5px] leading-relaxed text-[#8E8E93]">
        Passes are issued by CUMTA and accepted on MTC buses, CMRL metro and suburban rail services across Chennai.
      </p>
    </div>
  );
}
