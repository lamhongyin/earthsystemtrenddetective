import { analyzeAnnual, type TrendStats } from "./stats";
import { annualize, parsePowerMonthly, type AnnualObservation, type MonthlyObservation } from "./parse";
import { POWER_ENDPOINT, type ParameterDef } from "./config";

export type Point = { label: string; lat: number; lon: number; origin?: "search" | "preset" | "coordinates"; country?: boolean };
export type Snapshot = { mode: "single" | "compare"; param: ParameterDef; a: Point; b: Point; start: number; end: number };
export type PointResult = {
  point: Point; monthly: MonthlyObservation[]; annual: AnnualObservation[];
  stats: TrendStats | null; individualError: string | null;
  retrievedAt: string; sourceUrl: string; returnedPoint: number[] | null;
};
export type Comparison = { years: number[]; a: AnnualObservation[]; b: AnnualObservation[]; statsA: TrendStats; statsB: TrendStats; meanA: number; meanB: number };
export type Analysis = { snapshot: Snapshot; a?: PointResult; b?: PointResult; errors: Partial<Record<"A" | "B", string>> };

export function makePointResult(payloadText: string, point: Point, s: Snapshot, retrievedAt: string): PointResult {
  const payload = JSON.parse(payloadText);
  const monthly = parsePowerMonthly(payload, s.param.code, s.start, s.end);
  const annual = annualize(monthly, s.param.aggregation);
  let stats: TrendStats | null = null, individualError: string | null = null;
  try { stats = analyzeAnnual(annual.map(r => r.year), annual.map(r => r.value)); }
  catch (e) { individualError = e instanceof Error ? e.message : String(e); }
  const coordinates: unknown = payload?.geometry?.coordinates;
  const returnedPoint = Array.isArray(coordinates) && coordinates.every(v => typeof v === "number" && Number.isFinite(v)) ? coordinates : null;
  const url = new URL(POWER_ENDPOINT);
  url.search = new URLSearchParams({ parameters: s.param.code, community: "AG", latitude: String(point.lat), longitude: String(point.lon), start: String(s.start), end: String(s.end), format: "JSON" }).toString();
  return { point, monthly, annual, stats, individualError, retrievedAt, sourceUrl: url.toString(), returnedPoint };
}

export function alignCommonYears(a: AnnualObservation[], b: AnnualObservation[]) {
  const byB = new Map(b.map(r => [r.year, r]));
  const commonA = a.filter(r => byB.has(r.year)).sort((x, y) => x.year - y.year);
  const commonB = commonA.flatMap(r => { const row = byB.get(r.year); return row ? [row] : []; });
  return { years: commonA.map(r => r.year), a: commonA, b: commonB };
}
export function compareAnnual(a: AnnualObservation[], b: AnnualObservation[]): Comparison {
  const aligned = alignCommonYears(a, b);
  if (aligned.years.length < 8) throw new Error("At least eight common complete years are required to compare these locations.");
  const compute = (rows: AnnualObservation[], label: string) => {
    try { return analyzeAnnual(aligned.years, rows.map(r => r.value)); }
    catch (e) { throw new Error(`Location ${label}: ${e instanceof Error ? e.message : String(e)} Comparison could not be completed.`); }
  };
  return { ...aligned, statsA: compute(aligned.a, "A"), statsB: compute(aligned.b, "B"), meanA: aligned.a.reduce((sum, r) => sum + r.value, 0) / aligned.years.length, meanB: aligned.b.reduce((sum, r) => sum + r.value, 0) / aligned.years.length };
}
export function interpretation(a: Pick<TrendStats, "senSlope" | "significant" | "direction">, b: Pick<TrendStats, "senSlope" | "significant" | "direction">) {
  if (a.senSlope !== 0 && b.senSlope !== 0 && Math.sign(a.senSlope) !== Math.sign(b.senSlope)) {
    return a.significant && b.significant
      ? "Opposite trend directions, each significant at the 5% level."
      : "Estimated slopes point in opposite directions, but evidence is insufficient for one or both locations at the 5% level.";
  }
  return `Location A has an ${a.direction} estimate; location B has an ${b.direction} estimate. A ${a.significant ? "is" : "is not"} significant at the 5% level; B ${b.significant ? "is" : "is not"} significant at the 5% level.`;
}
export function warnings(rows: AnnualObservation[], stats: TrendStats | null): string[] {
  const out: string[] = [];
  if (stats?.autocorr !== null && stats?.autocorr !== undefined && Math.abs(stats.autocorr) > 0.3) out.push("Substantial detrended successive-observation correlation was detected. Mann–Kendall p-values assume independent observations and may require a modified test.");
  if (rows.some((r, i) => i > 0 && r.year - (rows[i - 1]?.year ?? r.year) > 1)) out.push("Years have gaps: correlation compares successive retained observations, not necessarily adjacent calendar years.");
  return out;
}
export function sameRequestedPoint(a: Point, b: Point) { return a.lat === b.lat && a.lon === b.lon; }
export function requestKey(s: Snapshot, p: Point) { return ["power", s.param.code, p.lat, p.lon, s.start, s.end] as const; }
export function snapshotKey(s: Snapshot) {
  return JSON.stringify([s.mode, s.param.code, s.start, s.end, s.a, ...(s.mode === "compare" ? [s.b] : [])]);
}