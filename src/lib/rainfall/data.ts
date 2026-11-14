import { daysInMonth, type AnnualObservation } from "../trend/parse";
import { pearson, theilslopes } from "../trend/stats";

export const RAINFALL_VERSION = "monthly-depth-v1";
export type RainUnit = "mm/day" | "mm/hour" | "kg/m2/s" | "mm";
export type Bounds = { west: number; south: number; east: number; north: number };
export type Support = { mode: "point" | "region"; bounds: Bounds; mask: string; resolution: string; aggregation: string; spatialCoverage: string };
export type RainRow = { month: string; periodStart: string; periodEnd: string; originalValue: number | null; valueMm: number | null; quality: string };
export type DemoMeta = { demoId: string; dataMode: "bundled_demonstration"; demonstrationOnly: true; availableStartMonth: string; availableEndMonth: string; expectedMonthlyRows: number; reportedDataBounds: Bounds; checkedImportedTextSha256: string; checkedImportAtUtc: string; automaticallyUpdated: false; loadedAtUtc?: string };
export type RainSeries = { sourceId: "POWER" | "IMERG"; datasetId: string; version: string; run: string; variable: string; originalUnit: RainUnit; quantityType: "calendar-month accumulated depth"; temporalResolution: "calendar month"; conversion: string; timeConvention: string; support: Support; accessRoute: string; retrievedAt: string; citation: string; sourceLink: string; sha256: string; originalText?: string; demo?: DemoMeta; rows: RainRow[] };
export const conversion = (unit: RainUnit) => ({ "mm/day": "mean daily rate × calendar days", "mm/hour": "mean hourly rate × 24 × calendar days", "kg/m2/s": "mean flux × 86400 × calendar days; 1 kg/m² water = 1 mm", mm: "exact calendar-month depth; unchanged" })[unit];
export function monthKey(value: string) {
  const m = /^(\d{4})-?(\d{2})(?:-(\d{2})(?:[T ]00:00:00(?:\.0+)?Z?)?)?$/.exec(value.trim());
  if (!m) throw new Error(`Unsupported monthly date: ${value}`);
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3] ?? 1);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d !== 1) throw new Error("Monthly dates must identify the first day of a valid calendar month; partial intervals are not supported.");
  return `${m[1]}-${m[2]}`;
}
export function rainRow(month: string, raw: number | null, unit: RainUnit): RainRow {
  const key = monthKey(month), [ys, ms] = key.split("-"), year = Number(ys), mo = Number(ms);
  const days = daysInMonth(year, mo);
  const valid = raw !== null && Number.isFinite(raw) && raw >= 0;
  return { month: key, periodStart: `${key}-01T00:00:00`, periodEnd: new Date(Date.UTC(year, mo, 1)).toISOString().replace(/\.000Z$/, ""), originalValue: raw, valueMm: valid ? (raw ?? 0) * (unit === "mm" ? 1 : unit === "mm/day" ? days : unit === "mm/hour" ? days * 24 : days * 86400) : null, quality: valid ? "valid" : raw !== null && raw < 0 ? "negative / fill; excluded" : "missing; excluded" };
}
export function validBounds(b: Bounds) {
  if (![b.west, b.south, b.east, b.north].every(Number.isFinite) || b.west < -180 || b.east > 180 || b.south < -90 || b.north > 90 || b.west >= b.east || b.south >= b.north) throw new Error("Enter valid non-dateline-crossing west, south, east, north bounds.");
}
export function checkSupport(a: Support, b: Support, point?: { lat: number; lon: number }) {
  validBounds(a.bounds); validBounds(b.bounds);
  if (a.mode !== b.mode) throw new Error("A regional series cannot be compared with a POWER point.");
  if (a.mode === "region") {
    if (JSON.stringify(a.bounds) !== JSON.stringify(b.bounds) || a.mask !== b.mask || a.aggregation !== b.aggregation) throw new Error("Regional comparison requires identical bounds, mask and boundary/area-weighting method.");
    if (!a.aggregation.toLowerCase().includes("area") || !a.aggregation.toLowerCase().includes("weight")) throw new Error("Regional support must document area weighting and boundary inclusion.");
  } else if (point) {
    for (const s of [a, b]) if (point.lon < s.bounds.west || point.lon >= s.bounds.east || point.lat < s.bounds.south || point.lat >= s.bounds.north) throw new Error("The imported source cell does not contain selected location A. Select the original location or import its own data.");
  }
}
export function annualTotals(rows: RainRow[]): AnnualObservation[] {
  const groups = new Map<number, RainRow[]>();
  for (const r of rows) { const y = Number(r.month.slice(0, 4)); groups.set(y, [...(groups.get(y) ?? []), r]); }
  return [...groups].sort(([a], [b]) => a - b).flatMap(([year, g]) => g.length === 12 && new Set(g.map(r => r.month)).size === 12 && g.every(r => r.valueMm !== null) ? [{ year, value: g.reduce((s, r) => s + (r.valueMm ?? 0), 0) }] : []);
}
export function descriptiveTrend(rows: AnnualObservation[]) {
  if (rows.length < 8) return null;
  return { slopeMmDecade: theilslopes(rows.map(r => r.value), rows.map(r => r.year)).slope * 10, method: "Theil–Sen; actual calendar years", significance: "Descriptive trend; significance not assessed" };
}
export function climatology(rows: RainRow[], start: number, end: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const g = rows.filter(r => Number(r.month.slice(5)) === i + 1 && Number(r.month.slice(0, 4)) >= start && Number(r.month.slice(0, 4)) <= end && r.valueMm !== null);
    return { month: i + 1, name: new Date(Date.UTC(2000, i)).toLocaleString("en", { month: "long", timeZone: "UTC" }), valueMm: g.length ? g.reduce((s, r) => s + (r.valueMm ?? 0), 0) / g.length : null, validYears: g.length, excludedYears: end - start + 1 - g.length, start, end };
  });
}
export function compareRainfall(power: RainSeries, imerg: RainSeries, start: number, end: number, point?: { lat: number; lon: number }) {
  if (power.sourceId !== "POWER" || imerg.sourceId !== "IMERG") throw new Error("Comparison requires separate POWER and IMERG products.");
  checkSupport(power.support, imerg.support, point);
  const select = (s: RainSeries) => s.rows.filter(r => Number(r.month.slice(0, 4)) >= start && Number(r.month.slice(0, 4)) <= end);
  const p = select(power), q = select(imerg), pm = new Map(p.map(r => [r.month, r])), qm = new Map(q.map(r => [r.month, r]));
  const months = Array.from({ length: (end - start + 1) * 12 }, (_, i) => `${start + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`);
  const monthly = months.map(month => { const powerMm = pm.get(month)?.valueMm ?? null, imergMm = qm.get(month)?.valueMm ?? null; return { month, powerMm, imergMm, differenceMm: powerMm !== null && imergMm !== null ? powerMm - imergMm : null }; });
  const matched = monthly.filter((r): r is typeof r & { powerMm: number; imergMm: number; differenceMm: number } => r.powerMm !== null && r.imergMm !== null && r.differenceMm !== null);
  if (!matched.length) throw new Error("No matched valid months; no missing values were replaced with zero.");
  const n = matched.length, totalI = matched.reduce((s, r) => s + r.imergMm, 0), corr = pearson(matched.map(r => r.powerMm), matched.map(r => r.imergMm));
  const pa = annualTotals(p), ia = annualTotals(q), iy = new Map(ia.map(r => [r.year, r.value]));
  const annual = pa.flatMap(r => iy.has(r.year) ? [{ year: r.year, powerMm: r.value, imergMm: iy.get(r.year) ?? 0 }] : []);
  return { monthly, annual, metrics: { sampleCount: n, expectedMonths: months.length, coverage: n / months.length, powerValid: p.filter(r => r.valueMm !== null).length, imergValid: q.filter(r => r.valueMm !== null).length, excludedMonths: monthly.filter(r => r.differenceMm === null).map(r => r.month), meanDifferenceMm: matched.reduce((s, r) => s + r.differenceMm, 0) / n, maeMm: matched.reduce((s, r) => s + Math.abs(r.differenceMm), 0) / n, rmseMm: Math.sqrt(matched.reduce((s, r) => s + r.differenceMm ** 2, 0) / n), correlation: Number.isFinite(corr) ? corr : null, percentBias: totalI > 1e-9 ? 100 * matched.reduce((s, r) => s + r.differenceMm, 0) / totalI : null, percentBiasDenominator: "sum of matched IMERG monthly totals" }, powerTrend: descriptiveTrend(annual.map(r => ({ year: r.year, value: r.powerMm }))), imergTrend: descriptiveTrend(annual.map(r => ({ year: r.year, value: r.imergMm }))), seasonal: climatology(matched.map(r => rainRow(r.month, r.powerMm, "mm")), start, end).map((r, i) => ({ ...r, powerMm: r.valueMm, imergMm: climatology(matched.map(v => rainRow(v.month, v.imergMm, "mm")), start, end)[i]?.valueMm ?? null })), availability: { power: [p[0]?.month, p.at(-1)?.month], imerg: [q[0]?.month, q.at(-1)?.month], powerCompleteYears: pa.length, imergCompleteYears: ia.length } };
}
export async function contentHash(text: string) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(v => v.toString(16).padStart(2, "0")).join(""); }
export function powerSeries(text: string, support: Support, retrievedAt: string): RainSeries {
  const j = JSON.parse(text), unit = j.parameters?.PRECTOTCORR?.units;
  if (unit !== "mm/day") throw new Error(`Unsupported POWER precipitation units: ${String(unit)}. No assumed conversion applied.`);
  const values = j.properties?.parameter?.PRECTOTCORR;
  if (!values || typeof values !== "object") throw new Error("POWER precipitation is absent.");
  return { sourceId: "POWER", datasetId: "POWER PRECTOTCORR / MERRA2", version: j.header?.api?.version ?? "not reported", run: "bias-corrected MERRA-2", variable: "PRECTOTCORR", originalUnit: unit, quantityType: "calendar-month accumulated depth", temporalResolution: "calendar month", conversion: conversion(unit), timeConvention: j.header?.time_standard ?? "not reported", support, accessRoute: "NASA POWER monthly point API", retrievedAt, citation: "NASA POWER Project, corrected precipitation from MERRA-2", sourceLink: "https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/", sha256: "", originalText: text, rows: Object.entries(values).filter(([k]) => /^\d{4}(0[1-9]|1[0-2])$/.test(k)).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => rainRow(k, typeof v === "number" && v !== j.header?.fill_value ? v : null, unit)) };
}
export function powerSupport(lat: number, lon: number): Support {
  const cx = Math.round(lon / 0.625) * 0.625, cy = Math.round(lat / 0.5) * 0.5;
  return { mode: "point", bounds: { west: Math.max(-180, cx - 0.3125), east: Math.min(180, cx + 0.3125), south: Math.max(-90, cy - 0.25), north: Math.min(90, cy + 0.25) }, mask: "native source cell; land and sea", resolution: "nominal MERRA-2 0.5° latitude × 0.625° longitude", aggregation: "native point/source cell; no regridding", spatialCoverage: "one native source cell; nominal footprint, not a gauge" };
}