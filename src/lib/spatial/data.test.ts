import { describe, expect, it } from "vitest";
import { annualMapValue, calendarDays, canonicalValue, cellAt, senPerDecade, type Raster } from "./data";
describe("spatial scientific rules", () => {
  it("converts mean flux to daily solar energy", () => { expect(canonicalValue(200, "ALLSKY_SFC_SW_DWN", 2024)).toBeCloseTo(4.8); });
  it("converts accumulated rainfall with actual leap-year duration", () => { expect(calendarDays(2024)).toBe(366); expect(canonicalValue(58, "PRECTOTCORR", 2024, 2)).toBe(2); expect(canonicalValue(730, "PRECTOTCORR", 2023)).toBe(2); });
  it("retains annual accumulated rainfall totals for map and trend", () => { expect(annualMapValue(730, "PRECTOTCORR", 2024)).toBe(730); expect(annualMapValue(-999, "PRECTOTCORR", 2024)).toBeNaN(); });
  it("preserves zero separately from missing", () => { expect(canonicalValue(0, "WS10M", 2024)).toBe(0); expect(canonicalValue(-999, "T2M", 2024)).toBeNaN(); expect(canonicalValue(Infinity, "T2M", 2024)).toBeNaN(); });
  it("uses actual years when estimating Sen slope with missing years", () => { expect(senPerDecade([2005, 2006, 2008, 2010], [0, NaN, 6, 10], 3)).toEqual({ slope: 20, count: 3 }); });
  it("requires all 20 annual values in the global product", () => { expect(senPerDecade(Array.from({ length: 20 }, (_, i) => 2005 + i), [...Array(19).fill(1), NaN]).slope).toBeNaN(); });
  it("wraps dateline and samples the correct northern or southern cell", () => {
    const r = { width: 2, height: 2, west: -180, north: 90, dx: 180, dy: 90, values: new Float32Array([0, 2, 3, NaN]) } as Raster;
    expect(cellAt(r, 45, 190)?.value).toBe(0); expect(cellAt(r, -45, -90)?.value).toBe(3); expect(cellAt(r, -45, 90)?.value).toBeNull();
  });
});