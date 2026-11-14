import { describe, expect, it } from "vitest";
import { investigate, parseRates, rateCcdf } from "./short-interval";
describe("Short interval research", () => {
  it("retains zeros and strict survival", () => { expect(rateCcdf([0, 2, 2, 4])).toEqual([{ rate: 0, percent: 75 }, { rate: 2, percent: 25 }, { rate: 4, percent: 0 }]); });
  it("enforces 30-minute starts and explicit rates", () => { expect(parseRates("timestamp_utc,rate_mm_h\n2024-01-01T00:00:00Z,2", 30)[0]?.rate).toBe(2); expect(() => parseRates("timestamp_utc,rate_mm_h\n2024-01-01T00:01:00Z,2", 30)).toThrow(); });
  it("rejects missing, duplicate and negative observations", () => { for (const value of ["", "-1", "NaN"]) expect(() => parseRates(`timestamp_utc,rate_mm_h\n2024-01-01T00:00:00Z,${value}`, 1)).toThrow(); expect(() => parseRates("timestamp_utc,rate_mm_h\n2024-01-01T00:00:00Z,0\n2024-01-01T00:00:00Z,1", 1)).toThrow(); });
  it("holds out later 30% and excludes incomplete gauge windows", () => { const half = Array.from({ length: 30 }, (_, i) => ({ time: Date.UTC(2024, 0, 1) + i * 1800000, rate: 2 })); const minute = half.flatMap(r => Array.from({ length: 30 }, (_, i) => ({ time: r.time + i * 60000, rate: 2 }))); minute.pop(); const r = investigate(half, minute); expect(r.matchedWindows).toBe(29); expect(r.excludedWindows).toBe(1); expect(r.trainWindows).toBe(20); expect(r.testWindows).toBe(9); expect(r.windowMae).toBe(0); expect(r.checks.every(c => c.error === 0)).toBe(true); });
  it("requires at least 20 complete paired windows", () => { expect(() => investigate([], [])).toThrow("20"); });
});