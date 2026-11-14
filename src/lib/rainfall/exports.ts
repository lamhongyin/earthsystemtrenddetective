import { csvRows, safePlaceText } from "../trend/csv";
import type { RainSeries, compareRainfall } from "./data";
export type RainComparison = ReturnType<typeof compareRainfall>;
export function monthlyRainCsv(s: RainSeries[]) {
  return csvRows([["source", "dataset", "version", "run", "variable", "month", "period_start", "period_end_exclusive", "time_convention", "original_value", "original_unit", "monthly_total_mm", "quality", "conversion", "access_route", "source_sha256"], ...s.flatMap(v => v.rows.map(r => [v.sourceId, v.datasetId, v.version, v.run, v.variable, r.month, r.periodStart, r.periodEnd, safePlaceText(v.timeConvention), r.originalValue, v.originalUnit, r.valueMm, r.quality, v.conversion, v.accessRoute, v.sha256]))]);
}
export function pairedMonthlyCsv(c: RainComparison) { return csvRows([["month", "POWER_mm", "IMERG_mm", "POWER_minus_IMERG_mm"], ...c.monthly.map(r => [r.month, r.powerMm, r.imergMm, r.differenceMm])]); }
export function pairedAnnualCsv(c: RainComparison) { return csvRows([["year", "POWER_annual_mm", "IMERG_annual_mm"], ...c.annual.map(r => [r.year, r.powerMm, r.imergMm])]); }
export function metricsCsv(c: RainComparison) { return csvRows([["metric", "value"], ...Object.entries(c.metrics).filter(([, v]) => typeof v !== "object").map(([k, v]) => [k, v as string | number | null]), ["common_complete_years", c.annual.length], ["POWER_Sen_mm_decade", c.powerTrend?.slopeMmDecade ?? null], ["IMERG_Sen_mm_decade", c.imergTrend?.slopeMmDecade ?? null], ["significance", "Descriptive; not assessed"]]); }
export function provenanceJson(s: RainSeries[], settings: unknown, comparison?: RainComparison | null) {
  return JSON.stringify({ calculationVersion: "monthly-depth-v1", settings, sources: s.map(({ originalText: _text, ...v }) => v), comparison, methodology: "Monthly accumulated mm; missing retained, 12 valid months per annual total; paired months for agreement and climatology; common complete years for actual-year Theil–Sen descriptive trends; no significance assessment. Products are not ground truth. No short-interval interpolation or attenuation modelling." }, null, 2);
}