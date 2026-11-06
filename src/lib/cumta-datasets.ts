// ─────────────────────────────────────────────────────────────────────────────
// CUMTA Official Transit Datasets (Chennai Unified Metropolitan Transport Authority)
// Verified against the live repository at https://test.cumta.org/datasets
// Licensed under the Government Open Data License – India (GODL)
// ─────────────────────────────────────────────────────────────────────────────

export type CumtaDataset = {
  id: "cmrl-metro" | "suburban-rail" | "mtc-bus";
  agency: string;
  shortName: string;
  description: string;
  lastUpdated: string;
  size: string;
  files: string[];
  downloadUrl: string;
  accent: string;
  light: string;
  border: string;
  format: "GTFS" | "GTFS + GeoJSON";
  mode: "metro" | "rail" | "bus";
  stats: {
    stopsOrStations: number;
    linesOrRoutes: number;
    fareRange: string;
  };
};

export const CUMTA_DATASETS: CumtaDataset[] = [
  {
    id: "cmrl-metro",
    agency: "Chennai Metro (CMRL)",
    shortName: "CMRL Metro",
    description: "Chennai Metro Rail Limited official schedules, station coordinates, and fare rules for Blue and Green lines.",
    lastUpdated: "Feb 02, 2026",
    size: "147 KB",
    files: [
      "agency.txt",
      "calendar.txt",
      "calendar_dates.txt",
      "fare_attributes.txt",
      "fare_rules.txt",
      "frequencies.txt",
      "routes.txt",
      "shapes.txt",
      "stop_times.txt",
      "stops.txt",
      "transfers.txt",
      "trips.txt",
    ],
    downloadUrl: "https://test.cumta.org/CMRL%20gtfs.zip",
    accent: "#0038A8",
    light: "#eef2ff",
    border: "#c7d2fe",
    format: "GTFS",
    mode: "metro",
    stats: {
      stopsOrStations: 42,
      linesOrRoutes: 2,
      fareRange: "₹10 – ₹60",
    },
  },
  {
    id: "suburban-rail",
    agency: "Suburban Rail",
    shortName: "Southern Railways",
    description: "Southern Railways Suburban network data covering North, South, and West lines in the CMA.",
    lastUpdated: "Feb 02, 2026",
    size: "257 KB",
    files: [
      "agency.txt",
      "calendar.txt",
      "calendar_dates.txt",
      "feed_info.txt",
      "pathways.txt",
      "routes.txt",
      "stop_times.txt",
      "stops.txt",
      "trips.txt",
      "GeoJSON files",
    ],
    downloadUrl: "https://test.cumta.org/Southern%20Railways.zip",
    accent: "#800000",
    light: "#fff1f2",
    border: "#fecdd3",
    format: "GTFS + GeoJSON",
    mode: "rail",
    stats: {
      stopsOrStations: 87,
      linesOrRoutes: 4,
      fareRange: "₹5 – ₹20",
    },
  },
  {
    id: "mtc-bus",
    agency: "MTC Bus",
    shortName: "MTC Chennai",
    description: "Metropolitan Transport Corporation (Chennai) bus routes, stop locations, and trip frequencies.",
    lastUpdated: "Feb 02, 2026",
    size: "27.3 MB",
    files: [
      "agency.txt",
      "calendar.txt",
      "frequencies.txt",
      "routes.txt",
      "stop_times.txt",
      "stops.txt",
      "trips.txt",
      "GeoJSON files",
    ],
    downloadUrl: "https://test.cumta.org/static_mtc_gtfs_data.zip",
    accent: "#FF8C00",
    light: "#fff7ed",
    border: "#fed7aa",
    format: "GTFS + GeoJSON",
    mode: "bus",
    stats: {
      stopsOrStations: 3420,
      linesOrRoutes: 650,
      fareRange: "₹6 – ₹50",
    },
  },
];

export const CUMTA_CATALOG_META = {
  title: "CUMTA Data Catalog",
  subtitle: "Download Chennai's public transit data in standardized GTFS formats.",
  license: "Government Open Data License – India (GODL)",
  portalUrl: "https://test.cumta.org/datasets",
  source: "Chennai Unified Metropolitan Transport Authority (CUMTA), Govt. of Tamil Nadu",
  lastVerified: "2026-11-06",
};

