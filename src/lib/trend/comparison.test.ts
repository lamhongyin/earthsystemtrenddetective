import { describe, expect, it } from "vitest";
import { alignCommonYears, compareAnnual, interpretation, requestKey, sameRequestedPoint, snapshotKey, warnings, type Analysis, type Snapshot } from "./comparison";
import { commonCsv, safePlaceText, statisticsCsv, summaryJson } from "./csv";
import { LOCATIONS, PARAMETERS, normalizeLongitude, validateCoords, validatePeriod } from "./config";
import { analyzeAnnual } from "./stats";
const parameter = PARAMETERS[0];
if (!parameter) throw new Error("Missing parameter fixture");
const s: Snapshot = { mode: "compare", param: parameter, a: { label: "A", lat: -23.5505, lon: -46.6333 }, b: { label: "B", lat: 51.5074, lon: -0.1278 }, start: 2005, end: 2024 };
const a = Array.from({ length: 12 }, (_, i) => ({ year: 2005 + i, value: i + Math.sin(i) }));
const b = a.filter(r => r.year !== 2006 && r.year !== 2010).map(r => ({ ...r, value: 40 - r.value * 2 }));
describe("worldwide comparison rules", () => {
  it("defaults and all worldwide presets have the specified coordinates", () => {
    expect(LOCATIONS[0]).toEqual({ label: "Johor Bahru, Johor", lat: 1.4927, lon: 103.7414 });
    expect(LOCATIONS.slice(5)).toEqual([
      { label: "London, United Kingdom", lat: 51.5074, lon: -0.1278 }, { label: "Cairo, Egypt", lat: 30.0444, lon: 31.2357 }, { label: "Nairobi, Kenya", lat: -1.2921, lon: 36.8219 }, { label: "New York City, United States", lat: 40.7128, lon: -74.0060 }, { label: "São Paulo, Brazil", lat: -23.5505, lon: -46.6333 }, { label: "Sydney, Australia", lat: -33.8688, lon: 151.2093 }, { label: "Tokyo, Japan", lat: 35.6762, lon: 139.6503 },
    ]);
  });
  it("accepts poles and western/southern coordinates and rejects invalid ranges", () => {
    expect(validateCoords(-90, -180)).toBeNull(); expect(validateCoords(90, 180)).toBeNull();
    expect(validateCoords(-23.5505, -46.6333)).toBeNull(); expect(validateCoords(91, 0)).not.toBeNull(); expect(validateCoords(0, 181)).not.toBeNull(); expect(validateCoords(NaN, 0)).not.toBeNull();
  });
  it("normalizes wrapped longitudes near the dateline without rounding", () => { expect(normalizeLongitude(540)).toBe(-180); expect(normalizeLongitude(-181)).toBe(179); expect(normalizeLongitude(179.123456)).toBeCloseTo(179.123456, 10); });
  it("keeps reproducible 1981–2025 years and requires eight inclusive years", () => { expect(validatePeriod(1980, 2024)).not.toBeNull(); expect(validatePeriod(2005, 2026)).not.toBeNull(); expect(validatePeriod(2005, 2012)).toBeNull(); expect(validatePeriod(2005, 2011)).not.toBeNull(); });
  it("intersects complete years, preserves gaps and recomputes every statistic", () => {
    const c = compareAnnual(a, b);
    expect(c.years).toEqual([2005, 2007, 2008, 2009, 2011, 2012, 2013, 2014, 2015, 2016]);
    expect(c.statsA).toEqual(analyzeAnnual(c.years, c.a.map(r => r.value)));
    expect(c.statsB).toEqual(analyzeAnnual(c.years, c.b.map(r => r.value)));
    expect(c.statsA.linearSlope).not.toBe(analyzeAnnual(a.map(r => r.year), a.map(r => r.value)).linearSlope);
  });
  it("rejects fewer than eight common years", () => { expect(() => compareAnnual(a, b.slice(0, 7))).toThrow("At least eight common complete years are required to compare these locations."); });
  it("rejects a nearly constant common series by location", () => { expect(() => compareAnnual(a, b.map(r => ({ ...r, value: 1 })))).toThrow("Location B: The data are nearly constant"); });
  it("identical points reuse a request key and yield identical statistics", () => { expect(requestKey(s, s.a)).toEqual(requestKey(s, { ...s.a, label: "Other label" })); expect(sameRequestedPoint(s.a, { ...s.a })).toBe(true); const c = compareAnnual(a, a); expect(c.statsA).toEqual(c.statsB); expect(c.meanA - c.meanB).toBe(0); });
  it("cache keys distinguish exact coordinates, years and variable", () => { expect(requestKey(s, s.a)).not.toEqual(requestKey(s, { ...s.a, lon: s.a.lon + 0.0000001 })); expect(requestKey(s, s.a)).not.toEqual(requestKey({ ...s, start: 2006 }, s.a)); expect(requestKey(s, s.a)).not.toEqual(requestKey({ ...s, param: { ...s.param, code: "RH2M" } }, s.a)); });
  it("snapshot changes include mode, variable, point and years", () => { expect(snapshotKey(s)).not.toBe(snapshotKey({ ...s, mode: "single" })); expect(snapshotKey(s)).not.toBe(snapshotKey({ ...s, end: 2025 })); expect(snapshotKey(s)).not.toBe(snapshotKey({ ...s, b: { ...s.b, lat: 0 } })); });
  it("describes significant opposite slopes without claiming causation", () => { expect(interpretation({ senSlope: 1, significant: true, direction: "increasing" }, { senSlope: -1, significant: true, direction: "decreasing" })).toBe("Opposite trend directions, each significant at the 5% level."); });
  it("qualifies nonsignificant opposite slopes", () => { expect(interpretation({ senSlope: 1, significant: false, direction: "increasing" }, { senSlope: -1, significant: true, direction: "decreasing" })).toBe("Estimated slopes point in opposite directions, but evidence is insufficient for one or both locations at the 5% level."); });
  it("describes same signs and zero estimates independently of significance", () => {
    expect(interpretation({ senSlope: 0, significant: false, direction: "approximately stable" }, { senSlope: 1, significant: true, direction: "increasing" })).toContain("approximately stable");
    expect(interpretation({ senSlope: 1, significant: false, direction: "increasing" }, { senSlope: 2, significant: true, direction: "increasing" })).toContain("A is not significant");
  });
  it("uses strict correlation threshold > 0.3 and gap warnings", () => { const stats = analyzeAnnual(a.map(r => r.year), a.map(r => r.value)); expect(warnings(a, { ...stats, autocorr: 0.3 })).toEqual([]); expect(warnings(a, { ...stats, autocorr: -0.30001 })).toHaveLength(1); expect(warnings(b, { ...stats, autocorr: null })[0]).toContain("successive retained"); });
  it("exports only common observations and protects place text, not numeric signs", () => {
    const c = compareAnnual(a, b), csv = commonCsv(c, "T2M", "°C");
    expect(csv.split("\n")[0]).toBe("year,A_T2M_°C,B_T2M_°C"); expect(csv).not.toContain("2006,"); expect(csv.trim().split("\n")).toHaveLength(11);
    expect(safePlaceText("=SUM(1,2)")).toBe("'=SUM(1,2)"); expect(safePlaceText(" @attack")).toBe("' @attack"); expect(safePlaceText("London")).toBe("London");
    const r: Analysis = { snapshot: s, errors: {}, a: { point: { ...s.a, label: "=attack" }, annual: a, monthly: [], stats: c.statsA, individualError: null, retrievedAt: "2026-11-14T00:00:00Z", sourceUrl: "https://power.larc.nasa.gov/", returnedPoint: null }, b: { point: s.b, annual: b, monthly: [], stats: c.statsB, individualError: null, retrievedAt: "2026-11-14T00:00:00Z", sourceUrl: "https://power.larc.nasa.gov/", returnedPoint: null } };
    expect(statisticsCsv(r, c)).toContain("'=attack,-23.5505,-46.6333");
    const json = JSON.parse(summaryJson(r, c)); expect(json.comparison.years).toEqual(alignCommonYears(a, b).years); expect(json.a.excludedYears).toBe(8); expect(json.comparison.excludedFromComparisonA).toBe(2);
  });
});