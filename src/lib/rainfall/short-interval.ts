import Papa from "papaparse";
export type RateRow = { time: number; rate: number };
export type RateSample = { rows: RateRow[]; interval: 1 | 30; hash: string; filename: string };
export function parseRates(text: string, interval: 1 | 30): RateRow[] {
  const csv = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  if (csv.errors.length || csv.meta.fields?.join(",") !== "timestamp_utc,rate_mm_h") throw new Error("CSV must have exactly timestamp_utc,rate_mm_h columns; rates are interval-average mm/h.");
  if (!csv.data.length || csv.data.length > 150000) throw new Error("Provide 1–150,000 records per file.");
  const seen = new Set<number>();
  return csv.data.map(row => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/.test(row.timestamp_utc ?? "")) throw new Error("Use UTC interval-start timestamps YYYY-MM-DDTHH:mm:00Z.");
    const time = Date.parse(row.timestamp_utc ?? ""), value = row.rate_mm_h?.trim() ?? "", rate = Number(value);
    if (!Number.isFinite(time) || time % (interval * 60000) !== 0 || new Date(time).toISOString().replace(".000", "") !== row.timestamp_utc || !value || !Number.isFinite(rate) || rate < 0 || seen.has(time)) throw new Error("Invalid, negative, duplicate or off-grid record; missing rainfall must not be filled.");
    seen.add(time); return { time, rate };
  }).sort((a, b) => a.time - b.time);
}
export function rateCcdf(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return [...new Set([0, ...sorted])].map(rate => ({ rate, percent: 100 * (sorted.length - upperBound(sorted, rate)) / sorted.length }));
}
function upperBound(sorted: number[], v: number) { let lo = 0, hi = sorted.length; while (lo < hi) { const mid = (lo + hi) >>> 1; if ((sorted[mid] ?? Infinity) <= v) lo = mid + 1; else hi = mid; } return lo; }
export function quantile(sorted: number[], q: number) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))] ?? 0; }
export function investigate(half: RateRow[], minute: RateRow[]) {
  const gauge = new Map(minute.map(r => [r.time, r.rate]));
  const pairs = half.flatMap(r => { const values = Array.from({ length: 30 }, (_, i) => gauge.get(r.time + i * 60000)); return values.every(v => v !== undefined) ? [{ ...r, minutes: values.filter((v): v is number => v !== undefined) }] : []; });
  if (pairs.length < 20) throw new Error("At least 20 common half-hour windows with all 30 gauge minutes are required; gaps are excluded.");
  const cut = Math.floor(pairs.length * .7), train = pairs.slice(0, cut), test = pairs.slice(cut);
  const x = train.map(r => r.rate).sort((a, b) => a - b), y = train.flatMap(r => r.minutes).sort((a, b) => a - b);
  const observed = test.flatMap(r => r.minutes), source = test.map(r => r.rate);
  const estimated = source.map(v => quantile(y, (upperBound(x, v) + upperBound(x, v - Number.EPSILON * Math.max(1, Math.abs(v)))) / (2 * x.length)));
  const obsSort = [...observed].sort((a, b) => a - b), estSort = [...estimated].sort((a, b) => a - b);
  const checks = [.5, .9, .95, .99].map(q => ({ q, observed: quantile(obsSort, q), estimated: quantile(estSort, q), error: quantile(estSort, q) - quantile(obsSort, q) }));
  return { matchedWindows: pairs.length, excludedWindows: half.length - pairs.length, trainWindows: train.length, testWindows: test.length, splitUtc: new Date(test[0]?.time ?? 0).toISOString(), checks, observed, estimated, source, windowMae: test.reduce((s, r) => s + Math.abs(r.rate - r.minutes.reduce((a, b) => a + b, 0) / 30), 0) / test.length };
}