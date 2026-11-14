import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { annualTotals, climatology, descriptiveTrend } from "./data";
import { DEMO_META, demoReview, loadDemoSeries } from "./demo";

const csvText = readFileSync("public/data/imerg-demo-2005-2024.csv", "utf8");
const load = () => loadDemoSeries(() => Promise.resolve(csvText));

describe("bundled IMERG demonstration", () => {
  it("loads the verified Giovanni export with its recorded identity", async () => {
    const s = await load();
    expect(s.sha256).toBe(DEMO_META.checkedImportedTextSha256);
    expect(s.sourceId).toBe("IMERG");
    expect(s.datasetId).toBe("GPM_3IMERGM_07");
    expect(s.version).toBe("07");
    expect(s.variable).toBe("GPM_3IMERGM_07_precipitation");
    expect(s.originalUnit).toBe("mm/hour");
    expect(s.demo?.demoId).toBe("imerg-regional-2005-2024-v1");
    expect(s.demo?.dataMode).toBe("bundled_demonstration");
    expect(s.demo?.demonstrationOnly).toBe(true);
    expect(s.demo?.automaticallyUpdated).toBe(false);
  });

  it("contains exactly 240 valid monthly observations from 2005-01 to 2024-12", async () => {
    const s = await load();
    expect(s.rows).toHaveLength(240);
    expect(s.rows[0]?.month).toBe("2005-01");
    expect(s.rows.at(-1)?.month).toBe("2024-12");
    expect(s.rows.every(r => r.valueMm !== null && r.quality === "valid")).toBe(true);
    expect(new Set(s.rows.map(r => r.month)).size).toBe(240);
  });

  it("keeps the fixed regional support and reported data bounds", async () => {
    const s = await load();
    expect(s.support.mode).toBe("region");
    expect(s.support.bounds).toEqual({ west: 102, south: 1, east: 104, north: 3 });
    expect(s.demo?.reportedDataBounds).toEqual({ west: 102.05, south: 1.05, east: 103.95, north: 2.95 });
    expect(s.sourceLink).toContain("giovanni.gsfc.nasa.gov");
  });

  it("converts hourly rates with real calendar days, including leap February 2024 (696 hours)", async () => {
    const s = await load();
    const feb = s.rows.find(r => r.month === "2024-02");
    expect(feb?.originalValue).not.toBeNull();
    expect(feb?.valueMm).toBeCloseTo((feb?.originalValue ?? 0) * 24 * 29, 10);
    const jan = s.rows.find(r => r.month === "2005-01");
    expect(jan?.valueMm).toBeCloseTo(0.150701508 * 24 * 31, 10);
  });

  it("yields 20 complete years, a climatology and a descriptive trend without significance", async () => {
    const s = await load();
    const annual = annualTotals(s.rows);
    expect(annual).toHaveLength(20);
    expect(annual[0]?.year).toBe(2005);
    expect(annual.at(-1)?.year).toBe(2024);
    const seasonal = climatology(s.rows, 2005, 2024);
    expect(seasonal).toHaveLength(12);
    expect(seasonal.every(m => m.validYears === 20 && m.excludedYears === 0)).toBe(true);
    const trend = descriptiveTrend(annual);
    expect(trend?.slopeMmDecade).toBeTypeOf("number");
    expect(trend?.significance).toContain("not assessed");
  });

  it("rejects a tampered file whose hash differs from the verified export", async () => {
    await expect(loadDemoSeries(() => Promise.resolve(csvText.replace("0.150701508", "0.150701509")))).rejects.toThrow(/SHA-256 mismatch/);
  });

  it("rejects a truncated file even if the hash check were bypassed", async () => {
    const truncated = csvText.split("\n").slice(0, -5).join("\n");
    await expect(loadDemoSeries(() => Promise.resolve(truncated))).rejects.toThrow();
  });

  it("review metadata declares the original unit and interval truthfully", () => {
    expect(demoReview.unit).toBe("mm/hour");
    expect(demoReview.intervalConfirmed).toBe(true);
    expect(demoReview.dateColumn).toBe("time");
    expect(demoReview.valueColumn).toBe("mean_GPM_3IMERGM_07_precipitation");
  });
});
