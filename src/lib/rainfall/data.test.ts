import { describe, expect, it } from "vitest";
import { annualTotals, compareRainfall, descriptiveTrend, powerSeries, powerSupport, rainRow, type RainSeries } from "./data";
const support = powerSupport(1.4927, 103.7414);
function series(sourceId: "POWER" | "IMERG", values: (number | null)[]): RainSeries { return { sourceId, datasetId: sourceId, version: "07", run: "Final", variable: "precipitation", originalUnit: "mm", quantityType: "calendar-month accumulated depth", temporalResolution: "calendar month", conversion: "unchanged", timeConvention: "UTC", support, accessRoute: "test-only fixture", retrievedAt: "2026-11-14", sourceLink: "", sha256: "", citation: "synthetic numerical unit test, not a case study", rows: values.map((v, i) => rainRow(`2024-${String(i + 1).padStart(2, "0")}`, v, "mm")) }; }
describe("canonical monthly rainfall depth", () => {
  it("converts mean mm/day with actual month duration", () => expect(rainRow("202404", 5, "mm/day").valueMm).toBe(150));
  it("converts mean mm/hour using 24 hours per day", () => expect(rainRow("2024-04", 0.5, "mm/hour").valueMm).toBe(360));
  it("converts kg/m2/s using seconds per month", () => expect(rainRow("2024-04", 1 / 86400, "kg/m2/s").valueMm).toBeCloseTo(30));
  it("does not multiply an already accumulated monthly depth", () => expect(rainRow("2024-04", 150, "mm").valueMm).toBe(150));
  it("retains leap-year February", () => expect(rainRow("2024-02", 2, "mm/day").valueMm).toBe(58));
  it("uses 28 days in common-year February", () => expect(rainRow("2023-02", 2, "mm/day").valueMm).toBe(56));
  it("preserves zero", () => expect(rainRow("2024-02", 0, "mm/hour").valueMm).toBe(0));
  it("excludes negative fill rather than turning it into zero", () => expect(rainRow("2024-02", -9999.9, "mm/hour").valueMm).toBeNull());
  it("requires all 12 valid months for annual totals", () => expect(annualTotals(series("POWER", Array(11).fill(10)).rows)).toEqual([]));
  it("sums 12 depths without a second duration multiplier", () => expect(annualTotals(series("POWER", Array(12).fill(10)).rows)).toEqual([{ year: 2024, value: 120 }]));
  it("rejects an annual total containing a missing month", () => expect(annualTotals(series("POWER", [...Array(11).fill(10), null]).rows)).toEqual([]));
  it("fits positive slopes on actual nonconsecutive years", () => expect(descriptiveTrend(Array.from({ length: 8 }, (_, i) => ({ year: 2000 + i * 2, value: 100 + i * 4 })))?.slopeMmDecade).toBe(20));
  it("fits negative trends", () => expect(descriptiveTrend(Array.from({ length: 8 }, (_, i) => ({ year: 2000 + i, value: 100 - i })))?.slopeMmDecade).toBe(-10));
  it("reports a zero descriptive slope without inventing significance", () => expect(descriptiveTrend(Array.from({ length: 8 }, (_, i) => ({ year: 2000 + i, value: 100 })))?.slopeMmDecade).toBe(0));
  it("does not fit fewer than eight complete years", () => expect(descriptiveTrend([{ year: 2024, value: 100 }])).toBeNull());
  it("matches calendar months not row position and excludes missing pairs", () => {
    const p = series("POWER", [10, 30, null]), i = series("IMERG", [8, 34, 10]); i.rows.reverse();
    const c = compareRainfall(p, i, 2024, 2024);
    expect(c.metrics.sampleCount).toBe(2); expect(c.metrics.meanDifferenceMm).toBe(-1); expect(c.metrics.maeMm).toBe(3); expect(c.metrics.rmseMm).toBeCloseTo(Math.sqrt(10)); expect(c.metrics.excludedMonths).toContain("2024-03");
  });
  it("does not report a zero denominator as zero bias", () => expect(compareRainfall(series("POWER", [1]), series("IMERG", [0]), 2024, 2024).metrics.percentBias).toBeNull());
  it("reports constant-series correlation as unassessed", () => expect(compareRainfall(series("POWER", [1, 1]), series("IMERG", [2, 2]), 2024, 2024).metrics.correlation).toBeNull());
  it("blocks regional versus point comparison", () => { const i = series("IMERG", [1]); i.support = { ...support, mode: "region" }; expect(() => compareRainfall(series("POWER", [1]), i, 2024, 2024)).toThrow(/regional/i); });
  it("blocks a new point outside an imported footprint", () => expect(() => compareRainfall(series("POWER", [1]), series("IMERG", [1]), 2024, 2024, { lat: 51, lon: 0 })).toThrow(/contain/));
  it("does not allow the same product under two source labels", () => expect(() => compareRainfall(series("POWER", [1]), series("POWER", [1]), 2024, 2024)).toThrow(/separate/));
  it("checks POWER metadata rather than assuming mm/day", () => expect(() => powerSeries(JSON.stringify({ parameters: { PRECTOTCORR: { units: "unknown" } } }), support, "today")).toThrow(/units/));
});