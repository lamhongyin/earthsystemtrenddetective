import { describe, expect, it } from "vitest";
import { empiricalCcdf, strictExceedance } from "./ccdf";
const rows = (values: (number | null)[]) => values.map((valueMm, i) => ({ month: `2005-${String(i + 1).padStart(2, "0")}`, valueMm }));
describe("strict empirical monthly survival", () => {
  it("groups ties and satisfies the supplied four-value example", () => {
    const c = empiricalCcdf(rows([100, 200, 200, 400]));
    expect(c.points.map(p => [p.thresholdMm, p.exceedanceCount, p.exceedancePercent])).toEqual([[0, 4, 100], [100, 3, 75], [200, 1, 25], [400, 0, 0]]);
  });
  it("preserves zeros in N while excluding missing, negative and nonfinite totals", () => {
    const c = empiricalCcdf(rows([0, 0, 10, null, -1, NaN, Infinity]));
    expect(c.validCount).toBe(3); expect(c.excludedCount).toBe(4);
    expect(c.points[0]?.exceedancePercent).toBeCloseTo(100 / 3, 12);
  });
  it("has no invented values for all missing", () => { expect(empiricalCcdf(rows([null, -1])).points).toEqual([]); });
  it("keeps the strict zero tail for N=1", () => { expect(empiricalCcdf(rows([50])).points.at(-1)).toEqual({ thresholdMm: 50, exceedanceCount: 0, validCount: 1, exceedancePercent: 0 }); });
  it("filters observations, not climatological means", () => {
    const r = Array.from({ length: 240 }, (_, i) => ({ month: `${2005 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`, valueMm: i }));
    expect(empiricalCcdf(r).validCount).toBe(240); expect(empiricalCcdf(r, 1).validCount).toBe(20);
    expect(empiricalCcdf(r, 1).points.at(-2)?.exceedancePercent).toBe(5);
  });
  it("evaluates arbitrary thresholds with the same strict rule", () => { expect(strictExceedance([100, 200, 200, 400], 200).percent).toBe(25); expect(strictExceedance([100, 200, 200, 400], 400).percent).toBe(0); });
});