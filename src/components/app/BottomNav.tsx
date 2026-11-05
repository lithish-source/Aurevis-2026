"use client";

import { useApp, type Tab } from "@/lib/app-store";
import { cn } from "@/lib/utils";

// Floating pill navigation with an elevated centre "BUS TICKET" action —
// matches the Chennai One v3 (CUMTA) design.

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M11.3 2.6a1 1 0 0 1 1.4 0l8 7.3a1 1 0 0 1-.7 1.7H19v8.5a1 1 0 0 1-1 1h-4.2v-6.2h-3.6V21H6a1 1 0 0 1-1-1v-8.5H3.9a1 1 0 0 1-.7-1.7z" />
    </svg>
  );
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z" />
      <path d="M13 5v2M13 11v2M13 17v2" strokeDasharray="0.5 3.4" />
    </svg>
  );
}

function PassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M2.5 9.5h6a2.5 2.5 0 0 0 0-5M2.5 14.5h6a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </svg>
  );
}

const NAV_ITEMS: { id: Tab; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "tickets", label: "Tickets", Icon: TicketIcon },
  { id: "pass", label: "Pass", Icon: PassIcon },
  { id: "account", label: "Account", Icon: AccountIcon },
];

export function BottomNav() {
  const { tab, setTab, openOverlay } = useApp();

  return (
    <nav aria-label="Main navigation" className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-5">
      <div className="pointer-events-auto relative flex items-center justify-between rounded-full bg-white px-3.5 py-2 shadow-[0_14px_44px_-8px_rgba(17,17,17,0.35)]">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />
        ))}

        {/* centre elevated action */}
        <button
          onClick={() => openOverlay("qrScan")}
          aria-label="Bus ticket — scan and book"
          className="relative -mt-9 flex h-[64px] w-[64px] shrink-0 flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#5B4FE9] to-[#3D7BF0] text-white shadow-[0_10px_26px_-4px_rgba(61,123,240,0.65)] ring-[5px] ring-white transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
            <path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1v2.2a1 1 0 0 1-2 0V18h-2.5v2.2a1 1 0 0 1-2 0V18H9v2.2a1 1 0 0 1-2 0V18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1 3v6h12V6H6zm.2 8.2a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm11.6 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z" />
          </svg>
          <span className="mt-0.5 text-[6.2px] font-extrabold tracking-[0.09em]">BUS TICKET</span>
        </button>

        {NAV_ITEMS.slice(2).map((item) => (
          <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />
        ))}
      </div>
    </nav>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: { id: Tab; label: string; Icon: (p: { className?: string }) => React.ReactNode };
  active: boolean;
  onClick: () => void;
}) {
  const { Icon } = item;
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-[64px] flex-col items-center gap-[3px] rounded-xl py-1 transition-colors",
        active ? "text-[#E8442E]" : "text-[#8E8E93] hover:text-slate-600"
      )}
    >
      <Icon className="h-[21px] w-[21px]" />
      <span className={cn("text-[9.5px] leading-none", active ? "font-bold text-[#111]" : "font-medium")}>{item.label}</span>
    </button>
  );
}
