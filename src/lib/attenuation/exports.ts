import { LOCAL_INPUTS, type MapResult } from "./local";
import { csvRows } from "../trend/csv";
export const CALCULATED_GRID_COLUMNS = ["latitude", "longitude", "Ap_dB", "A001_dB", "k", "alpha", "gamma_dB_km", "effective_path_km", "elevation_deg", "valid", "reason", "headroom_dB", "p_percent", "calculation_spacing_deg", "scenario", "local_R001_sha256", "local_h0_sha256"];
export function calculatedGridCsv(result: MapResult) {
  const s = result.scenario;
  return csvRows([CALCULATED_GRID_COLUMNS, ...result.points.map(p => [p.lat, p.lon, p.apDb, p.a001Db, p.k, p.alpha, p.gammaDbKm, p.effectivePathKm, p.elevationDeg, p.valid, p.reason, p.headroomDb, s.link.pPercent, s.spacingDeg, JSON.stringify(s), LOCAL_INPUTS.rain.hash, LOCAL_INPUTS.height.hash])]);
}