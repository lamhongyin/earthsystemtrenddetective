import { contentHash, type DemoMeta, type RainSeries } from "./data";
import { importGiovanni, inspectCsv, type ImportReview } from "./import";

export const DEMO_ASSET_PATH = "data/imerg-demo-2005-2024.csv";

export const DEMO_META = {
  demoId: "imerg-regional-2005-2024-v1",
  dataMode: "bundled_demonstration",
  demonstrationOnly: true,
  availableStartMonth: "2005-01",
  availableEndMonth: "2024-12",
  expectedMonthlyRows: 240,
  reportedDataBounds: { west: 102.05, south: 1.05, east: 103.95, north: 2.95 },
  checkedImportedTextSha256: "ad515eae56095d7d61d61fb2f97d7f7677adcc3167d8f6a1daad9665367e02ca",
  checkedImportAtUtc: "2026-11-14T16:44:33.420Z",
  automaticallyUpdated: false,
} satisfies DemoMeta;

export const demoReview = {
  sourceId: "IMERG",
  datasetId: "GPM_3IMERGM_07",
  version: "07",
  variable: "GPM_3IMERGM_07_precipitation",
  dateColumn: "time",
  valueColumn: "mean_GPM_3IMERGM_07_precipitation",
  unit: "mm/hour",
  timeConvention: "UTC; complete calendar months",
  citation:
    "NASA GPM IMERG Final Run V07 monthly precipitation; Giovanni area-averaged export, January 2005–December 2024",
  sourceLink:
    "https://giovanni.gsfc.nasa.gov/giovanni/#service=ArAvTs&starttime=2005-01-01T00:00:00Z&endtime=2024-12-31T23:59:59Z&bbox=102,1,104,3&data=GPM_3IMERGM_07_precipitation&portal=GIOVANNI&format=json",
  fillValues: "-9999.9",
  intervalConfirmed: true,
  support: {
    mode: "region",
    bounds: { west: 102, south: 1, east: 104, north: 3 },
    mask: "All valid cells within the requested rectangle; no additional land-only mask",
    resolution: "0.1°",
    aggregation: "Giovanni area-averaged monthly time series; boundary-cell rule not specified in export",
    spatialCoverage: "Reported data bounding box: 102.05,1.05,103.95,2.95; valid-cell counts not reported",
  },
} satisfies ImportReview;

export function demoAssetUrl() {
  return `${import.meta.env.BASE_URL}${DEMO_ASSET_PATH}`;
}

async function fetchDemoText() {
  const response = await fetch(demoAssetUrl());
  if (!response.ok) throw new Error(`The bundled demonstration file is unavailable (HTTP ${response.status}). Try reloading the page; no substitute data is shown.`);
  return response.text();
}

export async function loadDemoSeries(fetchText: () => Promise<string> = fetchDemoText): Promise<RainSeries> {
  const text = await fetchText();
  const hash = await contentHash(text);
  if (hash !== DEMO_META.checkedImportedTextSha256) throw new Error("The bundled demonstration file does not match the verified Giovanni export (SHA-256 mismatch). No substitute data is shown.");
  const series = await importGiovanni(inspectCsv(text), demoReview);
  const valid = series.rows.filter(r => r.valueMm !== null).length;
  if (series.rows.length !== DEMO_META.expectedMonthlyRows || valid !== DEMO_META.expectedMonthlyRows || series.rows[0]?.month !== DEMO_META.availableStartMonth || series.rows.at(-1)?.month !== DEMO_META.availableEndMonth) {
    throw new Error(`The demonstration file must contain ${DEMO_META.expectedMonthlyRows} valid monthly observations (${DEMO_META.availableStartMonth} to ${DEMO_META.availableEndMonth}); found ${series.rows.length} rows, ${valid} valid.`);
  }
  return {
    ...series,
    accessRoute: "Bundled Giovanni demonstration export (SHA-256 verified; fixed historical sample)",
    demo: { ...DEMO_META, loadedAtUtc: series.retrievedAt },
  };
}
