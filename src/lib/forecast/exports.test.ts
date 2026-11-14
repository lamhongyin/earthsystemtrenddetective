import { describe, it, expect } from "vitest";
import { forecastCsv, backtestCsv, metricsCsv, unit } from "./exports";
import type { ForecastResult } from "./types";
const metric = { count: 24, mae: 2, rmse: 3, mase: null, baselineMae: 1, skill: -100, coverage: 0.75, width: 6 };
const result = { settings: { latitude: 1, longitude: 2, parameter: "T2M", level: 0.95 }, observedEnd: "2024-12", selectedModel: "gradient_boosted", predictions: [{ month: "2025-01", lead: 1, prediction: -1.123456789, lower: -4, upper: 2, level: 0.95 }], backtest: [{ origin: "2020-01", target: "2020-02", lead: 1, observed: 3, prediction: 1, baseline: 2, lower: -2, upper: 4 }], metrics: { overall: metric, perLead: [{ lead: 1, ...metric }] } } as ForecastResult;
describe("forecast data exports", () => {
  it("preserves negative temperature and full precision with safe escaped labels", () => { const csv = forecastCsv(result, '=A,"B"'); expect(csv).toContain('-1.123456789'); expect(csv).toContain('"\'=A,""B"""'); expect(csv).toContain('2024-12,2025-01,1'); });
  it("exports backtest observed and benchmark on the same targets", () => { expect(backtestCsv(result)).toContain('2020-01,2020-02,1,3,1,2,-2,4'); });
  it("keeps negative skill and unavailable MASE rather than fabricated numbers", () => { expect(metricsCsv(result)).toContain('overall,24,2,3,,1,-100,0.75,6'); });
  it("uses monthly rainfall target units rather than daily or annual", () => { expect(unit('PRECTOTCORR')).toBe('mm/month'); });
});
