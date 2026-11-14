import { csvRows } from "@/lib/trend/csv";
import type { AirResult } from "./types";
export function hourlyAirCsv(r: AirResult) {
  return csvRows([["interval_start_UTC", "interval_end_UTC", "original_time_UTC", "PM2.5", "unit", "source", "data_type", "model_version", "collection", "snapshot", "initialization_UTC", "retrieval_UTC", "requested_lat", "requested_lon", "grid_lat", "grid_lon"], ...r.hours.map(h => [h.intervalStart, h.intervalEnd, h.originalTime, h.pm25, r.unit, r.source, r.dataType, r.modelVersion, r.collection, r.snapshotId, r.initializedAt, r.retrievedAt, r.requestedPoint.latitude, r.requestedPoint.longitude, r.gridPoint.latitude, r.gridPoint.longitude])]);
}
export function indexAirCsv(r: AirResult) {
  return csvRows([["window_start_UTC", "window_end_UTC", "valid_hours", "mean_PM2.5_ug_m3", "truncated_PM2.5", "estimated_index", "category", "above_scale", "scope", "standard", "snapshot"], ...r.windows24h.map(w => [w.start, w.end, w.validHours, w.meanPm25, w.truncatedPm25, w.aqi, w.category, w.aboveScale, r.indexScope, r.indexStandard, r.snapshotId])]);
}