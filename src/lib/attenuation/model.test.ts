import { describe, expect, it } from "vitest";
import { calculatePoint, coefficients, geoElevation, validateScenario, type Scenario } from "./model";
const s: Scenario = { mode: "satellite", frequencyGHz: 14.25, pPercent: 1, polarization: "horizontal", elevationDeg: 31.076991235657, altitudeKmAsl: .031382983999999, distanceKm: 10, antenna1KmAsl: .03, antenna2KmAsl: .03 };
describe("pinned ITU models", () => {
  // ITU CG-3M3J-13-ValEx-Rev8.3.0.xlsx, P.618-14 A_Rain row 23.
  // Exact rainfall/height are supplied as model inputs, NOT installed climatology or visitor observations.
  it("matches the independent official P.618-14 intermediate and final values", () => {
    const r = calculatePoint(s, 51.5, 26.48052, 2.45273333333333);
    expect(r.gammaDbKm).toBeCloseTo(1.58130839366869, 9);
    expect(r.effectivePathKm).toBeCloseTo(4.29901737938415, 9);
    expect(r.a001Db).toBeCloseTo(6.79807226654774, 9);
    expect(r.apDb).toBeCloseTo(.495317069022985, 9);
  });
  it("matches official p=.001% and .1% validation rows 32 and 26", () => {
    expect(calculatePoint({ ...s, pPercent: .001 }, 51.5, 26.48052, 2.45273333333333).apDb).toBeCloseTo(14.8998224790914, 9);
    expect(calculatePoint({ ...s, pPercent: .1 }, 51.5, 26.48052, 2.45273333333333).apDb).toBeCloseTo(2.18584742205216, 9);
  });
  it("matches the P.838-3 official horizontal/vertical 18 GHz table within rounding tolerance", () => {
    expect(coefficients(18, 0, 0).k).toBeCloseTo(.07078, 5); expect(coefficients(18, 0, 0).alpha).toBeCloseTo(1.0818, 4);
    expect(coefficients(18, 0, 90).k).toBeCloseTo(.07708, 5); expect(coefficients(18, 0, 90).alpha).toBeCloseTo(1.0025, 4);
    expect(coefficients(18, 0, 45).k).toBeCloseTo((.07078 + .07708) / 2, 5);
  });
  it("matches independent P.530-19 equations 32–36 with table-rounding tolerance", () => {
    const r = calculatePoint({ ...s, mode: "terrestrial", frequencyGHz: 18, pPercent: .1 }, 2, 100, 5);
    expect(r.a001Db).toBeCloseTo(52.93929779695887, 2); expect(r.apDb).toBeCloseTo(19.980237815617418, 2);
  });
  it("uses internal equation32 limits without clamping actual specific attenuation or link length", () => {
    const r = calculatePoint({ ...s, mode: "terrestrial", frequencyGHz: 1, distanceKm: 60, pPercent: .01 }, 2, 1, 5);
    expect(r.equation32).toEqual({ frequencyGHz: 6, distanceKm: 30, rainRateMmPerHour: 3 }); expect(r.apDb).toBe(r.a001Db);
    expect(r.gammaDbKm).toBeCloseTo(coefficients(1, 0, 0).k, 12);
  });
  it("anchors p=.01 exactly", () => { const r = calculatePoint({ ...s, pPercent: .01 }, 2, 100, 5); expect(r.apDb).toBe(r.a001Db); });
  it("accepts satellite p=2% but rejects terrestrial p=2%", () => {
    expect(validateScenario({ ...s, pPercent: 2 })).toEqual({}); expect(validateScenario({ ...s, mode: "terrestrial", pPercent: 2 }).pPercent).toBeTruthy();
  });
  it.each([.001, 5])("accepts satellite p limit %s", pPercent => { expect(validateScenario({ ...s, pPercent })).toEqual({}); });
  it.each([.001, 1])("accepts terrestrial p limit %s", pPercent => { expect(validateScenario({ ...s, mode: "terrestrial", pPercent })).toEqual({}); });
  it.each([0, -.1, .0009, 5.01, NaN, Infinity])("rejects unsupported p %s", pPercent => { expect(validateScenario({ ...s, pPercent }).pPercent).toBeTruthy(); });
  it("enforces model-specific frequency extents", () => {
    expect(validateScenario({ ...s, frequencyGHz: 55 })).toEqual({}); expect(validateScenario({ ...s, frequencyGHz: 56 }).frequencyGHz).toBeTruthy();
    expect(validateScenario({ ...s, mode: "terrestrial", frequencyGHz: 175 })).toEqual({}); expect(validateScenario({ ...s, mode: "terrestrial", frequencyGHz: 176 }).frequencyGHz).toBeTruthy();
    expect(validateScenario({ ...s, frequencyGHz: .99 }).frequencyGHz).toBeTruthy();
  });
  it("preserves zero rainfall and above-path branches before logarithms", () => { expect(calculatePoint(s, 2, 0, 5).apDb).toBe(0); expect(calculatePoint({ ...s, altitudeKmAsl: 6 }, 2, 100, 5).apDb).toBe(0); });
  it("does not turn missing rainfall into zero", () => { expect(calculatePoint(s, 2, null, 5).apDb).toBeNull(); });
  it("has finite low-angle results and monotone representative curves", () => {
    const low = { ...s, elevationDeg: 2 };
    expect(calculatePoint(low, 2, 100, 5).valid).toBe(true);
    const curve = [.001, .01, .1, 1, 5].map(pPercent => calculatePoint({ ...low, pPercent }, 2, 100, 5).apDb ?? NaN);
    expect(curve.every((a, i) => !i || a < (curve[i - 1] ?? NaN))).toBe(true);
  });
  it("uses GEO visibility rather than a fixed elevation", () => { expect(geoElevation(0, 103, 103, 0)).toBeCloseTo(90, 10); expect(geoElevation(0, -77, 103, 0)).toBeCloseTo(-90, 10); });
  it("masks wet-snow conditions and handles paths above precipitation", () => {
    const t = { ...s, mode: "terrestrial" as const };
    expect(calculatePoint(t, 52, 25, 2.5).reason).toBe("combined_wet_snow_model_required");
    expect(calculatePoint({ ...t, antenna1KmAsl: 8, antenna2KmAsl: 8 }, 52, 25, 2.5).apDb).toBe(0);
  });
});