"use client";

import { useState } from "react";
import { useApp } from "@/lib/app-store";
import { OverlayShell } from "@/components/app/OverlayShell";
import { CUMTA_DATASETS, CUMTA_CATALOG_META, type CumtaDataset } from "@/lib/cumta-datasets";
import { cn } from "@/lib/utils";

export function DataCatalogOverlay() {
  const { closeOverlay } = useApp();
  const [selectedDataset, setSelectedDataset] = useState<CumtaDataset | null>(null);

  return (
    <OverlayShell title="CUMTA Data Catalog" onClose={closeOverlay} headerClass="bg-white text-slate-900">
      <div className="flex flex-col space-y-4 px-4 pb-8 pt-3">
        {/* Intro Banner */}
        <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 rounded-full bg-[#1A56DB]/10 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#1A56DB]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1A56DB] animate-pulse" />
              Verified CUMTA Open Data
            </span>
            <a
              href={CUMTA_CATALOG_META.portalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-bold text-[#1A56DB] hover:underline"
            >
              test.cumta.org ↗
            </a>
          </div>
          <h2 className="mt-2 text-[14px] font-extrabold text-slate-800">Chennai Transit Data Catalog</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            Official standardized GTFS feeds and GIS spatial layers for MTC Bus, Chennai Metro (CMRL), and Southern Railways Suburban lines.
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-100/60 px-2.5 py-1 text-[9.5px] font-semibold text-sky-900">
            <span className="font-bold">License:</span> {CUMTA_CATALOG_META.license}
          </div>
        </div>

        {/* Dataset List */}
        <div className="space-y-3">
          {CUMTA_DATASETS.map((ds) => {
            const isSelected = selectedDataset?.id === ds.id;
            return (
              <div
                key={ds.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                style={{ borderColor: isSelected ? ds.accent : `${ds.border}90` }}
              >
                {/* Agency header banner */}
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: `linear-gradient(135deg, ${ds.light} 0%, #ffffff 100%)`, borderBottom: `1px solid ${ds.border}` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-black text-white"
                      style={{ backgroundColor: ds.accent }}
                    >
                      {ds.mode === "metro" ? "M" : ds.mode === "rail" ? "R" : "B"}
                    </span>
                    <h3 className="text-[13px] font-extrabold" style={{ color: ds.accent }}>
                      {ds.agency}
                    </h3>
                  </div>
                  <span className="rounded bg-white/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 shadow-sm border border-slate-200/60">
                    {ds.format}
                  </span>
                </div>

                <div className="p-4">
                  <p className="text-[11.5px] leading-relaxed text-slate-600">{ds.description}</p>

                  {/* Metrics Row */}
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center">
                    <div>
                      <p className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">Stations / Stops</p>
                      <p className="mt-0.5 text-[12px] font-extrabold text-slate-800">{ds.stats.stopsOrStations.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">Routes / Lines</p>
                      <p className="mt-0.5 text-[12px] font-extrabold text-slate-800">{ds.stats.linesOrRoutes}</p>
                    </div>
                    <div>
                      <p className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">Fare Range</p>
                      <p className="mt-0.5 text-[12px] font-extrabold text-slate-800">{ds.stats.fareRange}</p>
                    </div>
                  </div>

                  {/* Included Files */}
                  <div className="mt-3">
                    <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400">
                      Included Files ({ds.files.length})
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ds.files.map((file) => (
                        <span
                          key={file}
                          className="rounded-md border bg-slate-50/80 px-2 py-0.5 font-mono text-[9px] font-semibold text-slate-700"
                          style={{ borderColor: `${ds.border}80` }}
                        >
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action & Metadata */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-600">{ds.size}</span> · Updated {ds.lastUpdated}
                    </div>
                    <a
                      href={ds.downloadUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[11px] font-extrabold text-white shadow-sm transition hover:brightness-110 active:scale-95"
                      style={{ backgroundColor: ds.accent }}
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download ZIP
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </OverlayShell>
  );
}

