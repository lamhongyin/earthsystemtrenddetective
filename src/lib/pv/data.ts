import { daysInMonth, type MonthlyObservation } from "@/lib/trend/parse";
import { alignCommonYears } from "@/lib/trend/comparison";
import { analyzeAnnual } from "@/lib/trend/stats";
export const PV_VERSION = "horizontal-constant-pr-v1";
export const MAX_CAPACITY = 1_000_000;
export const SCENARIOS = [
  { id: "residential", label: "Residential rooftop", capacity: 5 },
  { id: "commercial", label: "Commercial rooftop", capacity: 50 },
  { id: "ground", label: "Ground-mounted", capacity: 1000 },
] as const;
export type PVSettings = { capacity: number; pr: number; scenario: string };
export type PVMonth = { year: number; month: number; days: number; ghi: number | null; irradiation: number | null; energy: number | null; valid: boolean };
export type PVYear = { year: number; count: number; irradiation: number | null; energy: number | null; specific: number | null; complete: boolean };
export function validatePV(s: PVSettings) {
  if (!Number.isFinite(s.capacity) || s.capacity <= 0 || s.capacity > MAX_CAPACITY) throw new Error(`DC capacity must be greater than zero and at most ${MAX_CAPACITY.toLocaleString()} kWp.`);
  if (!Number.isFinite(s.pr) || s.pr <= 0 || s.pr > 100) throw new Error("Assumed performance ratio must be greater than 0% and at most 100%.");
  if (!SCENARIOS.some(x => x.id === s.scenario)) throw new Error("Floating PV needs a validated thermal/loss model and is unavailable.");
}
export function monthYield(ghi: number | null, year: number, month: number, s: PVSettings): PVMonth {
  validatePV(s);
  const days = daysInMonth(year, month), valid = ghi !== null && Number.isFinite(ghi) && ghi >= 0;
  const irradiation = valid && ghi !== null ? ghi * days : null;
  return { year, month, days, ghi: valid ? ghi : null, irradiation, energy: irradiation === null ? null : s.capacity * irradiation * s.pr / 100, valid };
}
export function calculatePV(rows: MonthlyObservation[], start: number, end: number, settings: PVSettings) {
  validatePV(settings);
  const byDate = new Map(rows.map(r => [r.date.slice(0, 7), r.value]));
  const monthly = Array.from({ length: (end - start + 1) * 12 }, (_, i) => { const year = start + Math.floor(i / 12), month = i % 12 + 1; return monthYield(byDate.get(`${year}-${String(month).padStart(2, "0")}`) ?? null, year, month, settings); });
  const annual: PVYear[] = Array.from({ length: end - start + 1 }, (_, i) => { const year = start + i, rows = monthly.filter(r => r.year === year), count = rows.filter(r => r.valid).length, complete = count === 12; const energy = complete ? rows.reduce((s, r) => s + (r.energy ?? 0), 0) : null; return { year, count, complete, irradiation: complete ? rows.reduce((s, r) => s + (r.irradiation ?? 0), 0) : null, energy, specific: energy === null ? null : energy / settings.capacity }; });
  const climatology = Array.from({ length: 12 }, (_, i) => { const valid = monthly.filter(r => r.month === i + 1 && r.energy !== null); return { month: i + 1, count: valid.length, energy: valid.length ? valid.reduce((s, r) => s + (r.energy ?? 0), 0) / valid.length : null }; });
  return { monthly, annual, climatology };
}
export type PVData = ReturnType<typeof calculatePV>;
export function pvAnnualRows(data: PVData) { return data.annual.flatMap(r => r.energy === null ? [] : [{ year: r.year, value: r.energy }]); }
export function pvStats(rows: { year: number; value: number }[]) {
  try { return { stats: analyzeAnnual(rows.map(r => r.year), rows.map(r => r.value)), error: null }; }
  catch (e) { return { stats: null, error: e instanceof Error ? e.message : String(e) }; }
}
export function pvComparison(a: PVData, b: PVData) {
  const aligned = alignCommonYears(pvAnnualRows(a), pvAnnualRows(b));
  return { ...aligned, aStats: pvStats(aligned.a), bStats: pvStats(aligned.b) };
}