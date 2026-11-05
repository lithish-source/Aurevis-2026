"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** Full-screen sheet inside the phone frame with a light sub-header + back button. */
export function OverlayShell({
  title,
  onClose,
  children,
  headerClass = "bg-[#DDE3F5] text-[#3B67AF]",
  backLabel,
  footer,
  contentClass,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  headerClass?: string;
  backLabel?: string;
  footer?: React.ReactNode;
  contentClass?: string;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#F5F5F4] animate-[sheetin_0.32s_cubic-bezier(0.22,1,0.36,1)]">
      <header className={cn("flex items-center gap-3 px-4 pb-3 pt-4", headerClass)}>
        <button
          onClick={onClose}
          aria-label={backLabel ?? "Go back"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition active:scale-90"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold">{title}</h1>
      </header>
      <div className={cn("flex-1 overflow-y-auto overscroll-contain", contentClass)}>{children}</div>
      {footer && <div className="border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </div>
  );
}
