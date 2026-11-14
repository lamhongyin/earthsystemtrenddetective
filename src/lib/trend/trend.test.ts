import { describe, it, expect } from "vitest";
import ref from "./scipy-reference.fixture.json";
import { analyzeAnnual } from "./stats";
import { parsePowerMonthly, annualize } from "./parse";
import { validatePeriod } from "./config";

// Synthetic fixtures — test-only, never shown as NASA data. Tolerance: 1e-9 relative.
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(b)));

describe("statistics match SciPy reference", () => {
  for (const [name, c] of Object.entries(ref as Record<string, any>)) {
    it(name, () => {
      const s = analyzeAnnual(c.x, c.y);
      close(s.linearSlope, c.slope); close(s.rSquared, c.r2); close(s.kendallTau, c.tau);
      close(s.pValue, c.p); close(s.senSlope, c.sen); close(s.senCiLow, c.lo); close(s.senCiHigh, c.hi);
      close(s.autocorr!, c.ac); c.pred.forEach((v: number, i: number) => close(s.predicted[i], v));
    });
  }
});

function payload(code: string, from: number, to: number, val: (y: number, m: number) => unknown) {
  const d: Record<string, unknown> = {};
  for (let y = from; y <= to; y++) { for (let m = 1; m <= 12; m++) d[`${y}${String(m).padStart(2, "0")}`] = val(y, m); d[`${y}13`] = 999; }
  return { properties: { parameter: { [code]: d } } };
}

describe("parsing and aggregation", () => {
  it("1 mm/day gives 365 mm in 2023 and 366 mm in 2024", () => {
    const a = annualize(parsePowerMonthly(payload("PRECTOTCORR", 2023, 2024, () => 1), "PRECTOTCORR"), "sum_from_daily_mean");
    expect(a).toEqual([{ year: 2023, value: 365 }, { year: 2024, value: 366 }]);
  });
  it("leap-year weighted mean uses 29-day February", () => {
    const a = annualize(parsePowerMonthly(payload("T2M", 2024, 2024, (_y, m) => (m === 2 ? 0 : 10)), "T2M"), "weighted_mean");
    close(a[0].value, (10 * 337) / 366);
  });
  it("excludes month 13, fill values, null and empty; drops incomplete years", () => {
    const p = payload("T2M", 2020, 2021, (y, m) => (y === 2021 && m === 2 ? null : y === 2020 && m === 3 ? "" : 5));
    p.properties.parameter.T2M["202104"] = -999;
    const monthly = parsePowerMonthly(p, "T2M");
    expect(monthly.length).toBe(21);
    expect(monthly.every((m) => m.value === 5)).toBe(true);
    expect(() => annualize(monthly, "weighted_mean")).toThrow("No complete years with 12 valid months were available.");
  });
  it("rejects constant series and short series", () => {
    expect(() => analyzeAnnual([1, 2, 3, 4, 5, 6, 7, 8], Array(8).fill(3))).toThrow("nearly constant");
    expect(() => analyzeAnnual([1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 8])).toThrow("At least eight");
  });
  it("requires at least eight calendar years", () => {
    expect(validatePeriod(2005, 2011)).toMatch("eight");
    expect(validatePeriod(2005, 2012)).toBeNull();
  });
});
