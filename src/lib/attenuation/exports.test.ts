import { describe, expect, it } from "vitest";
import { CALCULATED_GRID_COLUMNS, calculatedGridCsv } from "./exports";
import type { MapResult } from "./local";
describe("calculated spatial download schema", () => {
  it("excludes sampled climatology while retaining engineering results and audit identity", () => {
    expect(CALCULATED_GRID_COLUMNS).not.toContain("R001_mm_h");
    expect(CALCULATED_GRID_COLUMNS).not.toContain("h0_km_ASL");
    expect(CALCULATED_GRID_COLUMNS).not.toContain("hR_km_ASL");
    expect(CALCULATED_GRID_COLUMNS).toEqual(["latitude", "longitude", "Ap_dB", "A001_dB", "k", "alpha", "gamma_dB_km", "effective_path_km", "elevation_deg", "valid", "reason", "headroom_dB", "p_percent", "calculation_spacing_deg", "scenario", "local_R001_sha256", "local_h0_sha256"]);
    const result = { scenario: { link: { pPercent: .01 }, spacingDeg: .125 }, points: [{ lat: 2, lon: 102, apDb: 52.5, a001Db: 52.5, rainRateMmPerHour: 987654.123, h0KmAsl: 987655.123, rainHeightKmAsl: 987656.123, effectivePathKm: 4, elevationDeg: 30, valid: true, reason: "ok", headroomDb: 7.5 }] } as unknown as MapResult;
    const csv = calculatedGridCsv(result);
    for (const sourceValue of ["987654.123", "987655.123", "987656.123"]) expect(csv).not.toContain(sourceValue);
    expect(csv).toContain("52.5");
    expect(csv).toContain("0.125");
  });
});