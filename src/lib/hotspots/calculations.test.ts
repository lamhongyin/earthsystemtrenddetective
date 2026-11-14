import { describe, expect, it } from "vitest";
import { analysisKey, calculateHotspots, candidateRules, cellAreaKm2, connectedCells, fitAnnual, inside, isCurrentResult, validateSettings, weightedQuantile, type AnnualData, type Settings } from "./calculations";
const years = Array.from({ length: 20 }, (_, i) => 2005 + i);
const settings: Settings = { mode: "warming", bounds: { west: -180, east: 180, south: -90, north: 90 }, start: 2005, end: 2024, threshold: 10, mask: "all-valid" };
describe("hotspot screening rules", () => {
  it("uses OLS per decade for positive, negative and zero slopes", () => { expect(fitAnnual(years, years.map(y => (y - 2005) * 2))?.slope).toBe(20); expect(fitAnnual(years, years.map(y => (y - 2005) * -3))?.slope).toBe(-30); expect(fitAnnual(years, years.map(() => 5))?.slope).toBe(0); });
  it("preserves the actual calendar years around gaps", () => { const values = years.map(y => 2 * (y - 2005)); values[4] = NaN; values[7] = NaN; expect(fitAnnual(years, values)?.slope).toBe(20); expect(fitAnnual(years, values)?.count).toBe(18); });
  it("requires at least 15 requested years", () => { expect(() => validateSettings({ ...settings, end: 2018 }, years)).toThrow("15"); expect(() => validateSettings({ ...settings, end: 2019 }, years)).not.toThrow(); });
  it("requires at least 90 percent valid annual values", () => { const values = years.map(y => y); values[1] = NaN; values[2] = NaN; expect(fitAnnual(years, values)).not.toBeNull(); values[3] = NaN; expect(fitAnnual(years, values)).toBeNull(); });
  it("requires at least 15 valid years", () => { const short = years.slice(0, 15), values = short.map(y => y); values[5] = NaN; expect(fitAnnual(short, values)).toBeNull(); });
  it("requires the first requested year", () => { const values = years.map(y => y); values[0] = NaN; expect(fitAnnual(years, values)).toBeNull(); });
  it("requires the last requested year", () => { const values = years.map(y => y); values[19] = NaN; expect(fitAnnual(years, values)).toBeNull(); });
  it("weights quantiles by physical cell area and includes ties", () => { expect(weightedQuantile([{ value: 1, weight: 9 }, { value: 10, weight: 1 }], 0.9)).toBe(1); expect(candidateRules(1, -2, 1, -2)).toEqual({ warming: true, drying: true }); });
  it("uses spherical cell bounds so polar rows weigh less", () => { const equator = cellAreaKm2({ west: 0, east: 1, south: 0, north: 1 }), polar = cellAreaKm2({ west: 0, east: 1, south: 80, north: 81 }); expect(equator).toBeCloseTo(12363.718, 2); expect(polar / equator).toBeLessThan(0.18); });
  it("returns no warming without positive slopes", () => { expect(candidateRules(-1, -1, -2, 0).warming).toBe(false); });
  it("returns no drying without negative slopes", () => { expect(candidateRules(1, 1, 0, 2).drying).toBe(false); });
  it("does not invent a combined group when the sets do not overlap", () => {
    const data = fixture([1, 2, 3, 4], [-4, -3, -2, -1]); expect(calculateHotspots(data, { ...settings, mode: "combined" }).candidateCount).toBe(0);
  });
  it("does not invent a strongest group in constant fields", () => { expect(calculateHotspots(fixture([1, 1, 1, 1], [-1, -1, -1, -1]), settings).candidateCount).toBe(0); });
  it("connects shared edges across rows and the global date line, not diagonals/gaps", () => {
    const grid = { width: 4, height: 3, west: -180, north: 90, dx: 90, dy: 60 };
    const flags = new Uint8Array([1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0]);
    const result = connectedCells(flags, grid); expect(result.groups.map(g => g.length).sort()).toEqual([1, 3]); expect(result.membership[0]).toBe(result.membership[3]); expect(result.membership[0]).toBe(result.membership[4]);
  });
  it("handles a drawn date-line-crossing area", () => { expect(inside(0, 175, { west: 170, east: -170, south: -10, north: 10 })).toBe(true); expect(inside(0, 0, { west: 170, east: -170, south: -10, north: 10 })).toBe(false); });
  it("keys results by source version, mask, area, period, threshold and mode", () => { const key = analysisKey(settings, "v1"); for (const s of [{ ...settings, threshold: 20 as const }, { ...settings, start: 2006 }, { ...settings, mode: "drying" as const }, { ...settings, bounds: { ...settings.bounds, south: -20 } }]) expect(analysisKey(s, "v1")).not.toBe(key); expect(analysisKey(settings, "v2")).not.toBe(key); expect(isCurrentResult(key, analysisKey({ ...settings, threshold: 20 }, "v1"))).toBe(false); });
  it("rejects partial worldwide arrays rather than labelling them global", () => { const data = fixture([1, 2, 3, 4], [-1, -2, -3, -4]); data.temperature[0] = new Float32Array(3); expect(() => calculateHotspots(data, settings)).toThrow("Incomplete"); });
});
function fixture(t: number[], r: number[]): AnnualData { return { grid: { width: 4, height: 1, west: -180, north: 45, dx: 90, dy: 90 }, years, temperature: years.map(y => Float32Array.from(t, slope => slope * (y - 2005))), rainfall: years.map(y => Float32Array.from(r, slope => 1000 + slope * (y - 2005))), version: "test" }; }