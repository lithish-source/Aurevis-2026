"use client";

import { useState } from "react";
import { CITY_SERVICES } from "@/lib/transit-data";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";

function ServiceIcon({ name }: { name: string }) {
  const common = "h-6 w-6";
  switch (name) {
    case "building":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M5 3h9v18H3V5a2 2 0 0 1 2-2zm2 3v2h2V6H7zm0 4v2h2v-2H7zm0 4v2h2v-2H7zm4-8v2h2V6h-2zm0 4v2h2v-2h-2zm0 4v2h2v-2h-2zM16 8h3a2 2 0 0 1 2 2v11h-5V8z" />
        </svg>
      );
    case "droplet":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M12 2s7 7.6 7 12.4A7 7 0 0 1 5 14.4C5 9.6 12 2 12 2z" />
        </svg>
      );
    case "baby":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <circle cx="12" cy="6" r="3.4" />
          <path d="M12 11c-4 0-7 2.6-7 5.6 0 1.8 1.6 2.9 3.3 2.4l2.2-.6h3l2.2.6c1.7.5 3.3-.6 3.3-2.4 0-3-3-5.6-7-5.6zM9.5 15.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4zm5 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z" />
        </svg>
      );
    case "file":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5L13 3.5zM8 12h8v1.6H8V12zm0 3.4h8V17H8v-1.6z" />
        </svg>
      );
    case "store":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M4 4h16l1.6 4.4A2 2 0 0 1 19.7 11H19v8a1 1 0 0 1-1 1h-4v-6h-4v6H6a1 1 0 0 1-1-1v-8h-.7a2 2 0 0 1-1.9-2.6L4 4zm1.2 2-.9 2.6h15.4L18.8 6H5.2z" />
        </svg>
      );
    case "megaphone":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M3 10v4a1 1 0 0 0 1 1h2l4 4h1a1 1 0 0 0 1-1v-3.2l7.2 2.7a1 1 0 0 0 1.3-.94V7.44a1 1 0 0 0-1.3-.94L12 9.2V6a1 1 0 0 0-1-1h-1L6 9H4a1 1 0 0 0-1 1z" />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M12 21s-8.4-5.5-10-10.3C.9 7 3 4 6.2 4 8.3 4 10 5.2 12 7.6 14 5.2 15.7 4 17.8 4 21 4 23.1 7 22 10.7 20.4 15.5 12 21 12 21z" />
        </svg>
      );
    case "ruler":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M3 8l5-5 13 13-5 5L3 8zm3.4.6 1.4 1.4 1.6-1.6 1.2 1.2-1.6 1.6 1.4 1.4 1.6-1.6 1.2 1.2-1.6 1.6 1.4 1.4 1.6-1.6 1.2 1.2-1.6 1.6 1 1 2.6-2.6L3 8l1-1z" />
        </svg>
      );
    case "lamp":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M9 3h6l3 6H6l3-6zm2 8h2v6h3v2H8v-2h3v-6z" />
        </svg>
      );
    case "trash":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 8h12l-1 13H7L6 8zm4 2v9h1.4v-9H10zm2.6 0v9H14v-9h-1.4z" />
        </svg>
      );
    case "health":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M10 3h4v6h6v4h-6v8h-4v-8H4V9h6V3z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M12 3l4 4h-3v10h-2V7H8l4-4z" />
        </svg>
      );
  }
}

export function ServicesScreen() {
  const { openOverlay, setSelectedService } = useApp();
  const [query, setQuery] = useState("");
  const filtered = CITY_SERVICES.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="h-full overflow-y-auto px-4 pb-28 pt-4">
      <header className="mb-4">
        <h1 className="text-[22px] font-bold text-slate-900">City Services</h1>
        <p className="text-[12.5px] text-slate-500">Greater Chennai Corporation · official services</p>
      </header>

      {/* search */}
      <div className="relative mb-4">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" fill="currentColor" aria-hidden>
          <path d="M10 3a7 7 0 1 0 4.24 12.56l4.1 4.1a1.2 1.2 0 0 0 1.7-1.7l-4.1-4.1A7 7 0 0 0 10 3zm0 2.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services"
          aria-label="Search services"
          className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-[13.5px] outline-none placeholder:text-slate-400 focus:border-[#E53935]/50 focus:ring-2 focus:ring-[#E53935]/15"
        />
      </div>

      {/* quick stats banner */}
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        {[
          { label: "Grievances", value: "2 open", color: "text-orange-600 bg-orange-50" },
          { label: "Property Tax", value: "₹0 due", color: "text-emerald-700 bg-emerald-50" },
          { label: "Water Bill", value: "₹312 due", color: "text-rose-600 bg-rose-50" },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-2xl p-3", s.color)}>
            <p className="text-[15px] font-extrabold leading-tight">{s.value}</p>
            <p className="mt-0.5 text-[10.5px] font-medium opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-[15px] font-bold text-slate-800">All services</h2>
      <div className="grid grid-cols-3 gap-x-2 gap-y-5">
        {filtered.map((s) => (
          <button
            key={s.name}
            onClick={() => {
              setSelectedService(s.name);
              openOverlay("serviceDetail");
            }}
            className="group relative flex flex-col items-center gap-2 rounded-2xl p-1 transition active:scale-95"
          >
            <span className={cn("flex h-[54px] w-[54px] items-center justify-center rounded-2xl", s.color)}>
              <ServiceIcon name={s.icon} />
            </span>
            {s.badge && (
              <span className="absolute right-1 top-0 rounded-full bg-[#E53935] px-1.5 py-0.5 text-[9px] font-bold text-white">{s.badge}</span>
            )}
            <span className="text-center text-[11px] font-semibold leading-tight text-slate-700">{s.name}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-16 text-center text-[13px] text-slate-400">No services match “{query}”</div>
      )}

      <div className="mt-7 rounded-2xl bg-gradient-to-tr from-[#1F3F66] to-[#3B67AF] p-4 text-white">
        <p className="text-[14px] font-bold">Chennai One Helpdesk</p>
        <p className="mt-1 text-[11.5px] opacity-85">For any civic issue, call 1913 or lodge a grievance online.</p>
      </div>
    </div>
  );
}
