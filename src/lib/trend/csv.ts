import type { AnnualObservation, MonthlyObservation } from "./parse";
import { warnings, type Analysis, type Comparison } from "./comparison";
import { SOLAR_CODE } from "./config";
export function solarMonthlyCsv(p: NonNullable<Analysis["a"]>) {
  return csvRows([["date", "raw_value", "raw_unit", "mean_daily_kWh_per_m2", "days_in_month", "monthly_total_kWh_per_m2"], ...p.monthly.map((r, i) => [r.date, p.solar?.raw[i]?.value ?? null, p.solar?.metadata.originalUnit ?? null, r.value, r.days, r.value * r.days])]);
}
export const esc = (v: string | number | boolean | null) => { const s = v === null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const safePlaceText = (s: string) => /^[\s]*[=+\-@\t\r]/.test(s) ? `'${s}` : s;
export const csvRows = (rows: (string | number | boolean | null)[][]) => rows.map(r => r.map(esc).join(",")).join("\n") + "\n";
export const annualCsv = (code: string, unit: string, rows: AnnualObservation[]) =>
  csvRows([["year", `${code}_${unit}`, ...(code === SOLAR_CODE ? ["annual_total_kWh_per_m2"] : [])], ...rows.map(r => [r.year, r.value, ...(code === SOLAR_CODE ? [r.value * (new Date(Date.UTC(r.year, 2, 0)).getUTCDate() === 29 ? 366 : 365)] : [])])]);
export const monthlyCsv = (rows: MonthlyObservation[]) =>
  [["date", "value"], ...rows.map((r) => [r.date, r.value])].map((r) => r.map(esc).join(",")).join("\n") + "\n";
export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const signed = (v: number, d = 3) => (v > 0 ? "+" : "") + v.toFixed(d);

export function commonCsv(c: Comparison, code: string, unit: string) {
  const solar = code === SOLAR_CODE;
  const days = (y: number) => new Date(Date.UTC(y, 2, 0)).getUTCDate() === 29 ? 366 : 365;
  return csvRows([["year", `A_${code}_${unit}`, `B_${code}_${unit}`, ...(solar ? ["A_annual_total_kWh_per_m2", "B_annual_total_kWh_per_m2"] : [])], ...c.a.map((r, i) => [r.year, r.value, c.b[i]?.value ?? null, ...(solar ? [r.value * days(r.year), (c.b[i]?.value ?? 0) * days(r.year)] : [])])]);
}
export function statisticsCsv(r: Analysis, c: Comparison) {
  const s = r.snapshot;
  const header = ["location", "label", "requested_latitude", "requested_longitude", "parameter", "annual_unit", "requested_start", "requested_end", "retained_first", "retained_last", "common_year_count", "mean", "OLS_slope", "Sen_slope", "Sen_CI_low", "Sen_CI_high", "tau", "p_value", "R_squared", "residual_correlation", "significant", "source_url", "retrieved_at", "community", "temporal_resolution", "canonical_unit_version", "original_unit", "normalized_unit", "conversion"];
  const rows = (["A", "B"] as const).flatMap(id => {
    const p = id === "A" ? r.a : r.b, stats = id === "A" ? c.statsA : c.statsB;
    if (!p) return [];
    // Google labels are transient display content; exports retain user-selected coordinates, not provider content.
    const label = p.point.origin === "search" ? `Selected point (${p.point.lat}, ${p.point.lon})` : p.point.label;
    return [[id, safePlaceText(label), p.point.lat, p.point.lon, s.param.code, s.param.annualUnit, s.start, s.end, c.years[0] ?? null, c.years.at(-1) ?? null, c.years.length, id === "A" ? c.meanA : c.meanB, stats.linearSlope, stats.senSlope, stats.senCiLow, stats.senCiHigh, stats.kendallTau, stats.pValue, stats.rSquared, stats.autocorr, stats.significant, p.sourceUrl, p.retrievedAt, p.sourceMetadata.community, p.sourceMetadata.temporalResolution, p.sourceMetadata.canonicalUnitVersion, p.solar?.metadata.originalUnit ?? s.param.unit, p.solar?.metadata.normalizedUnit ?? s.param.unit, p.solar?.metadata.conversion ?? "unchanged"]];
  });
  return csvRows([header, ...rows]);
}
export function summaryJson(r: Analysis, c?: Comparison) {
  const exportPoint = (p: Analysis["a"]) => p ? { ...p, point: { ...p.point, label: p.point.origin === "search" ? `Selected point (${p.point.lat}, ${p.point.lon})` : p.point.label }, warnings: warnings(p.annual, p.stats), excludedYears: r.snapshot.end - r.snapshot.start + 1 - p.annual.length } : null;
  const cleanPoint = (p: Analysis["snapshot"]["a"]) => ({ ...p, label: p.origin === "search" ? `Selected point (${p.lat}, ${p.lon})` : p.label });
  return JSON.stringify({ request: { ...r.snapshot, a: cleanPoint(r.snapshot.a), b: cleanPoint(r.snapshot.b) }, a: exportPoint(r.a), b: exportPoint(r.b), errors: r.errors, comparison: c ? { ...c, excludedFromComparisonA: (r.a?.annual.length ?? 0) - c.years.length, excludedFromComparisonB: (r.b?.annual.length ?? 0) - c.years.length, warningsA: warnings(c.a, c.statsA), warningsB: warnings(c.b, c.statsB) } : null, methodology: "NASA POWER monthly point data; 12 valid months per complete year; day-weighted means or rainfall rate × days; common-year alignment; SciPy-compatible OLS, Kendall tau-b (auto exact/asymptotic), Theil–Sen 95% rank interval; strict p < 0.05; detrended successive-observation Pearson correlation; no formal between-location slope test." }, (_key, value) => typeof value === "number" && !Number.isFinite(value) ? null : value, 2);
}
export function downloadJson(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
