export const NASA_GIS = "https://gis.earthdata.nasa.gov/portal/rest/services/POWER";
export const SPATIAL_PARAMETERS = [
  { code: "T2M", variable: "T2M", label: "Air temperature at 2 m", unit: "°C", min: -60, max: 40, first: 1981, family: "METEOROLOGY", native: "0.5° latitude × 0.625° longitude (MERRA-2)", conversion: "Celsius; no conversion" },
  { code: "PRECTOTCORR", variable: "PRECTOTCORR_SUM", label: "Corrected precipitation", unit: "mm/day", min: 0, max: 20, first: 1981, family: "METEOROLOGY", native: "0.5° latitude × 0.625° longitude (MERRA-2)", conversion: "Source accumulated mm divided by actual calendar days; annual total retained separately" },
  { code: "RH2M", variable: "RH2M", label: "Relative humidity at 2 m", unit: "%", min: 0, max: 100, first: 1981, family: "METEOROLOGY", native: "0.5° latitude × 0.625° longitude (MERRA-2)", conversion: "Percent; no conversion" },
  { code: "WS10M", variable: "WS10M", label: "Wind speed at 10 m", unit: "m/s", min: 0, max: 20, first: 1981, family: "METEOROLOGY", native: "0.5° latitude × 0.625° longitude (MERRA-2)", conversion: "Metres per second; no conversion" },
  { code: "ALLSKY_SFC_SW_DWN", variable: "ALLSKY_SFC_SW_DWN", label: "Solar energy on a horizontal surface", unit: "kWh/m²/day", min: 0, max: 9, first: 1984, family: "RADIATION", native: "1° latitude × 1° longitude (CERES SYN1deg)", conversion: "Mean W/m² × 24 / 1000 = mean daily kWh/m²" },
] as const;
export type SpatialCode = typeof SPATIAL_PARAMETERS[number]["code"];
export type SpatialMode = "annual" | "monthly" | "trend" | "average";
export type Slice = { code: SpatialCode; mode: SpatialMode; year: number; month: number };
export type Raster = { values: Float32Array; width: number; height: number; west: number; north: number; dx: number; dy: number; counts?: Uint8Array; source: string; retrievedAt: string; slice: Slice };
export const spatialParameter = (code: SpatialCode) => SPATIAL_PARAMETERS.find(p => p.code === code) ?? SPATIAL_PARAMETERS[0];
export const serviceFor = (code: SpatialCode, mode: "annual" | "monthly") => `${NASA_GIS}/POWER_${mode.toUpperCase()}_${spatialParameter(code).family}_LST/ImageServer`;
export function calendarDays(year: number, month?: number) { return month ? new Date(Date.UTC(year, month, 0)).getUTCDate() : (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365); }
export function canonicalValue(raw: number, code: SpatialCode, year: number, month?: number): number {
  if (!Number.isFinite(raw) || raw === -999) return NaN;
  if (code !== "T2M" && raw < 0) return NaN;
  if (code === "RH2M" && raw > 100) return NaN;
  return code === "ALLSKY_SFC_SW_DWN" ? raw * 0.024 : code === "PRECTOTCORR" ? raw / calendarDays(year, month) : raw;
}
export function cellAt(r: Raster, lat: number, lon: number) {
  const longitude = ((lon - r.west) % 360 + 360) % 360 + r.west;
  const x = Math.floor((longitude - r.west) / r.dx), y = Math.floor((r.north - lat) / r.dy);
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return null;
  const i = y * r.width + x;
  const value = r.values[i];
  return { index: i, value: value !== undefined && Number.isFinite(value) ? value : null, lat: r.north - (y + 0.5) * r.dy, lon: r.west + (x + 0.5) * r.dx, count: r.counts?.[i] ?? null };
}
export function senPerDecade(years: number[], values: number[], minimum = years.length) {
  const pairs = years.map((year, i) => ({ year, value: values[i] })).filter((p): p is { year: number; value: number } => p.value !== undefined && Number.isFinite(p.value));
  if (pairs.length < minimum || pairs.length < 2) return { slope: NaN, count: pairs.length };
  const slopes: number[] = [];
  for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) {
    const a = pairs[i], b = pairs[j];
    if (a && b && b.year !== a.year) slopes.push((b.value - a.value) / (b.year - a.year));
  }
  slopes.sort((a, b) => a - b);
  const half = Math.floor(slopes.length / 2), lo = slopes[half - 1], hi = slopes[half];
  return { slope: hi === undefined ? NaN : (slopes.length % 2 ? hi : ((lo ?? hi) + hi) / 2) * 10, count: pairs.length };
}
export function sliceLabel(s: Slice) { return s.mode === "trend" || s.mode === "average" ? "2005–2024" : s.mode === "monthly" ? `${s.year}-${String(s.month).padStart(2, "0")}` : String(s.year); }