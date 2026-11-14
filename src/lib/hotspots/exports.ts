import { CALCULATION_VERSION, cellAreaKm2, cellBounds, cellCentre, type Result } from "./calculations";
import type { Manifest } from "./load";
export function hotspotCsv(result: Result, manifest?: Manifest) {
  const header = "cell_id,area_id,latitude,longitude,west,east,south,north,grid_dx_degrees,grid_dy_degrees,area_km2,start_year,end_year,temperature_valid_years,rainfall_valid_years,temperature_ols_C_per_decade,rainfall_ols_mm_per_decade,mean_annual_temperature_C,mean_annual_rainfall_mm,candidate_type,threshold_percent,warming_cutoff_C_per_decade,drying_cutoff_mm_per_decade,mask,study_west,study_east,study_south,study_north,calculation_version,source_version,prepared_at,temperature_variable,rainfall_variable,source_time_convention";
  const lines = [header], s = result.settings;
  for (let i = 0; i < result.membership.length; i++) {
    if (!Number.isFinite(result.temperature[i])) continue;
    const c = cellCentre(result.grid, i), b = cellBounds(result.grid, i), area = result.membership[i] ?? 0;
    lines.push([i, area, c.lat, c.lon, b.west, b.east, b.south, b.north, result.grid.dx, result.grid.dy, cellAreaKm2(b), s.start, s.end, result.temperatureCount[i], result.rainfallCount[i], result.temperature[i], result.rainfall[i], result.temperatureMean[i], result.rainfallMean[i], area ? s.mode : "not-selected", s.threshold, result.warmingCutoff ?? "", result.dryingCutoff ?? "", s.mask, s.bounds.west, s.bounds.east, s.bounds.south, s.bounds.north, CALCULATION_VERSION, manifest?.version ?? "", manifest?.preparedAt ?? "", "T2M", "PRECTOTCORR_SUM", "LST"].join(","));
  }
  return lines.join("\n");
}
export function hotspotDetails(result: Result, manifest: Manifest) {
  return { calculationVersion: CALCULATION_VERSION, source: manifest, settings: result.settings, completedAt: result.completedAt, key: result.key, counts: { inArea: result.inArea, eligible: result.eligible, excluded: result.excluded, candidateCells: result.candidateCount, connectedAreas: result.areas.length }, eligibleKm2: result.eligibleKm2, candidateKm2: result.candidateKm2, cutoffs: { warming: result.warmingCutoff, drying: result.dryingCutoff }, percentileMethod: "Inverse empirical area-weighted CDF, inclusive ties; jointly eligible temperature/rainfall cells", areaMethod: "Spherical area R=6371.0088 km from clipped true latitude/longitude bounds; all cells including ocean", neighbourhood: "Four shared edges, cyclic longitude across date line, no missing-data connections", warnings: result.warnings, areas: result.areas, interpretation: "Relative historical screening, not significance, hazard probability, event detection or drought index" };
}