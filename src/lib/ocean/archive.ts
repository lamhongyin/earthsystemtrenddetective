import { z } from "zod";
import { OCEAN_SOURCES, OCEAN_VERSION, commonMonth, type OceanCode, type OceanMetadata, type OceanRecord, type OceanTarget, validateOceanTarget } from "./data";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const asset = z.object({ path: z.string().regex(/^\/fisheries\/[a-zA-Z0-9_./-]+$/).refine(p => !p.includes("..")), sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive().max(8_000_000) });
const metadata = z.object({ id: z.string(), title: z.string(), start: z.string(), end: z.string(), times: z.array(month), unit: z.string(), version: z.string(), summary: z.string(), latFirst: z.number(), latLast: z.number(), lonFirst: z.number(), lonLast: z.number(), retrievedAt: z.string(), resolution: z.number().positive() });
export const manifestSchema = z.object({ schema: z.literal(OCEAN_VERSION), bundle: z.string(), createdAt: z.string().datetime(), sources: z.object({ sst: z.object({ metadata, maps: z.record(z.string(), asset), histories: asset, provenance: z.record(z.string(), z.unknown()) }).optional(), chlorophyll: z.object({ metadata, maps: z.record(z.string(), asset), histories: asset, provenance: z.record(z.string(), z.unknown()) }).optional() }) }).superRefine((m, ctx) => {
  for (const code of ["sst", "chlorophyll"] as const) {
    const s = m.sources[code]; if (!s) continue;
    if (s.metadata.id !== OCEAN_SOURCES[code].id || s.metadata.unit !== OCEAN_SOURCES[code].unit || !s.metadata.times.length || new Set(s.metadata.times).size !== s.metadata.times.length || s.metadata.times.some(t => !s.maps[t]) || Object.keys(s.maps).some(t => !s.metadata.times.includes(t))) ctx.addIssue({ code: "custom", message: "Prepared product, units, dates or assets are inconsistent." });
  }
});
export type Manifest = z.infer<typeof manifestSchema>;
export function defaultMonth(sources: OceanMetadata[], code: OceanCode, now: string) {
  const own = sources.find(s => s.id === OCEAN_SOURCES[code].id)?.times ?? [];
  const other = sources.find(s => s.id !== OCEAN_SOURCES[code].id)?.times ?? [];
  return commonMonth(own, other, now) ?? own.filter(m => m < now.slice(0, 7)).sort().at(-1) ?? "";
}
export async function verifyAsset(bytes: ArrayBuffer, spec: z.infer<typeof asset>) {
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(x => x.toString(16).padStart(2, "0")).join("");
  if (bytes.byteLength !== spec.bytes || digest !== spec.sha256) throw new Error("Prepared asset failed integrity verification. Retry or use another variable.");
}
async function manifest() {
  const r = await fetch("/fisheries/manifest.json", { cache: "no-cache" });
  if (!r.ok) throw new Error("No prepared NASA dataset is installed yet.");
  const raw = z.object({ schema: z.literal(OCEAN_VERSION), bundle: z.string(), createdAt: z.string().datetime(), sources: z.record(z.string(), z.unknown()) }).parse(await r.json());
  const sources: Manifest["sources"] = {};
  for (const code of ["sst", "chlorophyll"] as const) {
    if (!raw.sources[code]) continue;
    const parsed = manifestSchema.safeParse({ ...raw, sources: { [code]: raw.sources[code] } });
    if (parsed.success) sources[code] = parsed.data.sources[code];
  }
  return { ...raw, sources };
}
async function readAsset(spec: z.infer<typeof asset>) {
  const r = await fetch(spec.path, { cache: "force-cache" }); if (!r.ok) throw new Error("Prepared asset is unavailable. Retry this source.");
  const bytes = await r.arrayBuffer(); await verifyAsset(bytes, spec); return bytes;
}
const rasterSchema = z.object({ width: z.literal(360), height: z.literal(180), values: z.array(z.number().finite().nullable()).length(64800), coverage: z.array(z.number().min(0).max(1)).length(64800), month, bounds: z.object({ south: z.literal(-90), north: z.literal(90), west: z.literal(-180), east: z.literal(180) }) });
export function rasterCell(raster: z.infer<typeof rasterSchema>, lat: number, lon: number) {
  const x = Math.min(359, Math.max(0, Math.floor(lon + 180))), y = Math.min(179, Math.max(0, Math.floor(90 - lat)));
  const i = y * 360 + x;
  return { lat: 89.5 - y, lon: -179.5 + x, value: raster.values[i] ?? null, coverage: raster.coverage[i] ?? 0 };
}
async function source(code: OceanCode) { const m = await manifest(); const s = m.sources[code]; if (!s) throw new Error("No prepared dates available for this variable."); return { m, s }; }
async function raster(code: OceanCode, date: string) { const { m, s } = await source(code); const spec = s.maps[date]; if (!spec) throw new Error("This location/period is not included in the prepared archive."); const r = rasterSchema.parse(JSON.parse(new TextDecoder().decode(await readAsset(spec)))); if (r.month !== date) throw new Error("Prepared observation month does not match its manifest."); return { m, s, r }; }
export async function preparedMetadata() { const m = await manifest(); return { sources: Object.values(m.sources).flatMap(s => s ? [s.metadata] : []), createdAt: m.createdAt }; }
export async function preparedImage(code: OceanCode, date: string) {
  const { s, r } = await raster(code, date);
  const canvas = document.createElement("canvas"); canvas.width = r.width; canvas.height = r.height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("The scientific map could not be drawn.");
  const pixels = ctx.createImageData(r.width, r.height);
  // Same five stops as the existing ocean-legend token, interpolated in RGB.
  const colors = getComputedStyle(document.documentElement).getPropertyValue("--ocean-raster-colors").trim().split("/").map(c => c.split(",").map(Number));
  const sdef = OCEAN_SOURCES[code];
  r.values.forEach((v, i) => { if (v === null) return; const f = Math.max(0, Math.min(1, code === "sst" ? (v - sdef.low) / (sdef.high - sdef.low) : (Math.log10(v) - Math.log10(sdef.low)) / (Math.log10(sdef.high) - Math.log10(sdef.low)))); const scaled = f * 4, idx = Math.min(3, Math.floor(scaled)), t = scaled - idx; for (let c = 0; c < 3; c++) pixels.data[i * 4 + c] = Math.round((colors[idx]?.[c] ?? 0) * (1 - t) + (colors[idx + 1]?.[c] ?? 0) * t); pixels.data[i * 4 + 3] = 255; });
  ctx.putImageData(pixels, 0, 0);
  return { image: canvas.toDataURL(), bounds: r.bounds, month: date, sourceTime: `${date} monthly composite`, retrievedAt: s.metadata.retrievedAt, spacing: 1, metadata: s.metadata };
}
const historySchema = z.array(z.object({ target: z.object({ lat: z.number(), lon: z.number(), bounds: z.object({ south: z.number(), north: z.number(), west: z.number(), east: z.number() }).optional() }), cell: z.object({ lat: z.number(), lon: z.number() }).nullable(), months: z.array(z.object({ month, value: z.number().finite().nullable(), coverage: z.number().min(0).max(1), validCells: z.number().int().nonnegative(), oceanCells: z.number().int().nonnegative() })), maskMethod: z.string() }));
export async function preparedHistory(target: OceanTarget, start: number, end: number): Promise<OceanRecord[]> {
  validateOceanTarget(target);
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start || end - start > 24) throw new Error("Choose a valid period of at most 25 years.");
  const m = await manifest(); const records: OceanRecord[] = [];
  for (const code of ["sst", "chlorophyll"] as const) {
    const s = m.sources[code]; if (!s) continue;
    const histories = historySchema.parse(JSON.parse(new TextDecoder().decode(await readAsset(s.histories))));
    const history = histories.find(h => Math.abs(h.target.lat - target.lat) < 1e-6 && Math.abs(h.target.lon - target.lon) < 1e-6 && JSON.stringify(h.target.bounds) === JSON.stringify(target.bounds));
    if (!history) continue;
    const months = history.months.filter(v => Number(v.month.slice(0, 4)) >= start && Number(v.month.slice(0, 4)) <= end);
    if (!months.length) continue;
    records.push({ code, ...history, target, months, metadata: s.metadata, retrievedAt: m.createdAt, sourceUrl: "https://search.earthdata.nasa.gov/search/granules", maskMethod: history.maskMethod });
  }
  if (!records.length) throw new Error("This location/period is not included in the prepared archive.");
  return records;
}
export async function preparedPoint(code: OceanCode, date: string, lat: number, lon: number): Promise<OceanRecord> {
  const { s, r, m } = await raster(code, date); const cell = rasterCell(r, lat, lon);
  return { code, target: { lat, lon }, cell, months: [{ month: date, value: cell.value, coverage: cell.coverage, validCells: cell.value === null ? 0 : 1, oceanCells: 1 }], metadata: s.metadata, retrievedAt: m.createdAt, sourceUrl: "https://search.earthdata.nasa.gov/search/granules", maskMethod: "Prepared 1° area-weighted overview cell; missing native observations remain missing. Not a native 9 km measurement." };
}