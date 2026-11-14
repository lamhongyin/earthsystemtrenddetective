import type { RainRow, RainSeries } from "./data";
import { csvRows } from "../trend/csv";

export type CcdfPoint = { thresholdMm: number; exceedanceCount: number; validCount: number; exceedancePercent: number };
export const validTotal = (v: number | null): v is number => v !== null && Number.isFinite(v) && v >= 0;
export function empiricalCcdf(rows: Pick<RainRow, "month" | "valueMm">[], monthFilter = 0) {
  const included = rows.filter(r => !monthFilter || Number(r.month.slice(5, 7)) === monthFilter);
  const values = included.map(r => r.valueMm).filter(validTotal).sort((a, b) => a - b);
  const n = values.length;
  const thresholds = [...new Set(values.length && (values[0] ?? 0) > 0 ? [0, ...values] : values)];
  const points: CcdfPoint[] = [];
  let cursor = 0;
  for (const thresholdMm of thresholds) {
    while (cursor < n && (values[cursor] ?? Infinity) <= thresholdMm) cursor++;
    const exceedanceCount = n - cursor;
    points.push({ thresholdMm, exceedanceCount, validCount: n, exceedancePercent: 100 * exceedanceCount / n });
  }
  return { values, points, validCount: n, excludedCount: included.length - n, includedCount: included.length };
}
export function strictExceedance(values: number[], thresholdMm: number) {
  if (!Number.isFinite(thresholdMm)) throw new Error("Threshold must be finite.");
  const valid = values.filter(validTotal), count = valid.filter(v => v > thresholdMm).length;
  return { count, validCount: valid.length, percent: valid.length ? 100 * count / valid.length : null };
}
export function ccdfCsv(series: RainSeries[], monthFilter: number, period: string) {
  return csvRows([["threshold_mm", "exceedance_count", "valid_count", "exceedance_percent", "excluded_count", "source", "period", "month_filter", "spatial_support", "source_hash", "demonstration_status"], ...series.flatMap(s => {
    const c = empiricalCcdf(s.rows, monthFilter);
    return c.points.map(p => [p.thresholdMm, p.exceedanceCount, p.validCount, p.exceedancePercent, c.excludedCount, s.sourceId, period, monthFilter || "All months", JSON.stringify(s.support), s.sha256, s.demo ? "bundled historical demonstration" : "submitted observations"]);
  })]);
}