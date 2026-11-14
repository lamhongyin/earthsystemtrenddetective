export type Aggregation = "weighted_mean" | "sum_from_daily_mean";
export type ParameterDef = {
  label: string; code: "T2M" | "PRECTOTCORR" | "RH2M" | "WS10M";
  unit: string; annualUnit: string; aggregation: Aggregation; description: string;
};
export const PARAMETERS: ParameterDef[] = [
  { label: "Temperature (2 m)", code: "T2M", unit: "°C", annualUnit: "°C", aggregation: "weighted_mean", description: "Annual average air temperature at 2 m" },
  { label: "Corrected precipitation", code: "PRECTOTCORR", unit: "mm/day", annualUnit: "mm", aggregation: "sum_from_daily_mean", description: "Estimated annual rainfall total" },
  { label: "Relative humidity (2 m)", code: "RH2M", unit: "%", annualUnit: "%", aggregation: "weighted_mean", description: "Annual average relative humidity" },
  { label: "Wind speed (10 m)", code: "WS10M", unit: "m/s", annualUnit: "m/s", aggregation: "weighted_mean", description: "Annual average wind speed" },
];
export const PARAMETER_CODES = PARAMETERS.map((p) => p.code);
export const LOCATIONS = [
  { label: "Johor Bahru, Johor", lat: 1.4927, lon: 103.7414 },
  { label: "Muar, Johor", lat: 2.0442, lon: 102.5689 },
  { label: "Kuala Lumpur", lat: 3.139, lon: 101.6869 },
  { label: "Kuching, Sarawak", lat: 1.5533, lon: 110.3592 },
  { label: "Kota Kinabalu, Sabah", lat: 5.9804, lon: 116.0735 },
] as const;
export const CUSTOM_LOCATION = "Custom coordinates";
export const MIN_YEAR = 1981;
export const MAX_YEAR = 2025;
export const POWER_ENDPOINT = "https://power.larc.nasa.gov/api/temporal/monthly/point";

export function validatePeriod(start: number, end: number): string | null {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < MIN_YEAR || end > MAX_YEAR || start > MAX_YEAR || end < MIN_YEAR)
    return `Years must be whole numbers between ${MIN_YEAR} and ${MAX_YEAR}.`;
  if (!(end > start) || end - start < 7) return "Choose at least eight calendar years (e.g., 2005–2024).";
  return null;
}
export function validateCoords(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return "Latitude must be a number between −90 and 90.";
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return "Longitude must be a number between −180 and 180.";
  return null;
}
