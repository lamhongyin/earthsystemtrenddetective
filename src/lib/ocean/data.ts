export const OCEAN_VERSION = "ocean-month-effects-v1";
export const ERDDAP = "https://coastwatch.pfeg.noaa.gov/erddap";
export const OCEAN_SOURCES = {
  sst: { id: "jplMURSST41mday", variable: "sst", unit: "°C", originalUnit: "degree_C", resolution: 0.01, label: "Sea-surface temperature", producer: "NASA JPL MUR v4.1; NOAA monthly derivative", low: -2, high: 35 },
  chlorophyll: { id: "erdMH1chlamday_R2022SQ", variable: "chlor_a", unit: "mg/m³", originalUnit: "mg m-3", resolution: 1 / 24, label: "Chlorophyll-a", producer: "NASA MODIS Aqua Level-3 monthly composite", low: 0.03, high: 30 },
} as const;
export type OceanCode = keyof typeof OCEAN_SOURCES;
export type OceanBounds = { south: number; north: number; west: number; east: number };
export type OceanTarget = { lat: number; lon: number; bounds?: OceanBounds | undefined };
export type OceanRow = { time: string; lat: number; lon: number; value: number | null; mask?: number; nobs?: number };
export type OceanMonth = { month: string; value: number | null; coverage: number; validCells: number; oceanCells: number };
export type OceanMetadata = { id: string; title: string; start: string; end: string; times: string[]; unit: string; version: string; summary: string; latFirst: number; latLast: number; lonFirst: number; lonLast: number; retrievedAt: string; resolution: number };
export type OceanRecord = { code: OceanCode; target: OceanTarget; cell: { lat: number; lon: number } | null; months: OceanMonth[]; metadata: OceanMetadata; retrievedAt: string; sourceUrl: string; maskMethod: string };
export const normalizeLongitude = (lon: number) => ((lon + 180) % 360 + 360) % 360 - 180;
export const daysInMonth = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
export function decodeOcean(raw: number, unit: string, fill: number, minimum = -Infinity, maximum = Infinity) {
  if (!Number.isFinite(raw) || raw === fill || raw < minimum || raw > maximum) return null;
  if (unit === "K" || unit === "kelvin") return raw - 273.15;
  if (unit === "degree_C" || unit === "degrees_C" || unit === "mg m-3") return raw;
  throw new Error("Unsupported ocean source units.");
}
export function monthRange(start: number, end: number) { return Array.from({ length: (end - start + 1) * 12 }, (_, i) => `${start + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`); }
export function commonMonth(a: string[], b: string[], now: string) { const months = new Set(b.map(t => t.slice(0, 7))); return a.map(t => t.slice(0, 7)).filter(m => months.has(m) && m < now.slice(0, 7)).sort().at(-1) ?? null; }
export function axisIndices(first: number, last: number, step: number, low: number, high: number) {
  const n = Math.round(Math.abs(last - first) / step) + 1;
  const a = (low - first) / (last >= first ? step : -step), b = (high - first) / (last >= first ? step : -step);
  return { start: Math.max(0, Math.ceil(Math.min(a, b) - 1e-5)), end: Math.min(n - 1, Math.floor(Math.max(a, b) + 1e-5)) };
}
export function validateOceanTarget(t: OceanTarget) {
  if (!Number.isFinite(t.lat) || !Number.isFinite(t.lon) || Math.abs(t.lat) > 89.9 || Math.abs(t.lon) > 180) throw new Error("Choose valid ocean coordinates between 89.9°S and 89.9°N.");
  if (t.bounds) {
    const b = t.bounds;
    if (![b.south, b.north, b.west, b.east].every(Number.isFinite) || b.south >= b.north || b.west >= b.east || b.north - b.south > 0.12 || b.east - b.west > 0.12 || Math.abs(b.south) > 89.9 || Math.abs(b.north) > 89.9 || b.west < -180 || b.east > 180) throw new Error("Regions must be at most 0.12° × 0.12°. Split date-line regions into two investigations.");
  }
}
export function dailyToMonthly(rows: OceanRow[], months: string[]) {
  return months.map(month => {
    const valid = new Map(rows.filter(r => r.time.startsWith(month) && r.value !== null && r.mask === 1).map(r => [r.time.slice(0, 10), r.value as number]));
    const coverage = valid.size / daysInMonth(month);
    return { month, value: coverage >= 0.8 ? [...valid.values()].reduce((s, v) => s + v, 0) / valid.size : null, coverage, validCells: valid.size, oceanCells: daysInMonth(month) };
  });
}
export function oceanMean(rows: OceanRow[], eligible: Map<string, number>, months: string[], code: OceanCode) {
  const total = [...eligible.values()].reduce((s, w) => s + w, 0);
  return months.map(month => {
    let sum = 0, validWeight = 0, count = 0;
    for (const r of rows.filter(r => r.time.slice(0, 7) === month)) {
      const w = eligible.get(`${r.lat},${r.lon}`);
      if (!w || r.value === null || (code === "sst" && ((r.mask !== 1) || (r.nobs ?? 0) / daysInMonth(month) < 0.8))) continue;
      sum += w * r.value; validWeight += w; count++;
    }
    const coverage = total ? validWeight / total : 0;
    return { month, value: coverage >= 0.7 && validWeight > 0 ? sum / validWeight : null, coverage, validCells: count, oceanCells: eligible.size };
  });
}
export function cellWeight(lat: number, lon: number, step: number, bounds?: OceanBounds) {
  const south = Math.max(lat - step / 2, bounds?.south ?? -90), north = Math.min(lat + step / 2, bounds?.north ?? 90);
  const west = Math.max(lon - step / 2, bounds?.west ?? -180), east = Math.min(lon + step / 2, bounds?.east ?? 180);
  return Math.max(0, (east - west) * Math.PI / 180 * (Math.sin(north * Math.PI / 180) - Math.sin(south * Math.PI / 180)));
}
export function seasonalTrend(months: OceanMonth[], start: number, end: number) {
  const valid = months.filter((r): r is OceanMonth & { value: number } => r.value !== null && Number.isFinite(r.value));
  const coverage = valid.length / ((end - start + 1) * 12);
  const groups = Array.from({ length: 12 }, (_, m) => valid.filter(r => Number(r.month.slice(5, 7)) === m + 1));
  const eligible = end - start + 1 >= 15 && coverage >= 0.8 && groups.every(g => g.length >= Math.ceil((end - start + 1) * 0.7));
  if (!eligible) return { slope: null, coverage, valid: valid.length, reason: "Trend requires ≥15 requested years, ≥80% valid months overall and ≥70% representation of every calendar month." };
  let xx = 0, xy = 0;
  for (const group of groups) {
    const x = (r: OceanMonth) => Number(r.month.slice(0, 4)) + (Number(r.month.slice(5, 7)) - 0.5) / 12;
    const mx = group.reduce((s, r) => s + x(r), 0) / group.length, my = group.reduce((s, r) => s + r.value, 0) / group.length;
    for (const r of group) { xx += (x(r) - mx) ** 2; xy += (x(r) - mx) * (r.value - my); }
  }
  return { slope: xx > 0 ? xy / xx * 10 : null, coverage, valid: valid.length, reason: "Descriptive month-effect linear slope; significance not assessed. Calendar-month means of both time and values are removed over the submitted period. No causal or climate-attribution claim." };
}
export class OceanRequestGate { private id = 0; next() { return ++this.id; } current(id: number) { return id === this.id; } cancel() { this.id++; } }