export type Aggregation = "weighted_mean" | "sum_from_daily_mean";
export type ParameterDef = {
  label: string; code: "T2M" | "PRECTOTCORR" | "RH2M" | "WS10M" | "ALLSKY_SFC_SW_DWN";
  unit: string; annualUnit: string; aggregation: Aggregation; description: string;
};
export const PARAMETERS: ParameterDef[] = [
  { label: "Temperature (2 m)", code: "T2M", unit: "°C", annualUnit: "°C", aggregation: "weighted_mean", description: "Annual average air temperature at 2 m" },
  { label: "Corrected precipitation", code: "PRECTOTCORR", unit: "mm/day", annualUnit: "mm", aggregation: "sum_from_daily_mean", description: "Estimated annual rainfall total" },
  { label: "Relative humidity (2 m)", code: "RH2M", unit: "%", annualUnit: "%", aggregation: "weighted_mean", description: "Annual average relative humidity" },
  { label: "Wind speed (10 m)", code: "WS10M", unit: "m/s", annualUnit: "m/s", aggregation: "weighted_mean", description: "Annual average wind speed" },
  { label: "Solar irradiance — GHI", code: "ALLSKY_SFC_SW_DWN", unit: "kWh/m²/day", annualUnit: "kWh/m²/day", aggregation: "weighted_mean", description: "Annual mean daily solar energy on a horizontal surface" },
];
export const PARAMETER_CODES = PARAMETERS.map((p) => p.code);
export const LOCATIONS = [
  { label: "Johor Bahru, Johor", lat: 1.4927, lon: 103.7414 },
  { label: "Muar, Johor", lat: 2.0442, lon: 102.5689 },
  { label: "Kuala Lumpur", lat: 3.139, lon: 101.6869 },
  { label: "Kuching, Sarawak", lat: 1.5533, lon: 110.3592 },
  { label: "Kota Kinabalu, Sabah", lat: 5.9804, lon: 116.0735 },
  { label: "London, United Kingdom", lat: 51.5074, lon: -0.1278 },
  { label: "Cairo, Egypt", lat: 30.0444, lon: 31.2357 },
  { label: "Nairobi, Kenya", lat: -1.2921, lon: 36.8219 },
  { label: "New York City, United States", lat: 40.7128, lon: -74.0060 },
  { label: "São Paulo, Brazil", lat: -23.5505, lon: -46.6333 },
  { label: "Sydney, Australia", lat: -33.8688, lon: 151.2093 },
  { label: "Tokyo, Japan", lat: 35.6762, lon: 139.6503 },
] as const;
export const CUSTOM_LOCATION = "Custom coordinates";
export const MIN_YEAR = 1981;
export const MAX_YEAR = 2025;
export const POWER_ENDPOINT = "https://power.larc.nasa.gov/api/temporal/monthly/point";
export const SOLAR_CODE = "ALLSKY_SFC_SW_DWN";
export const CANONICAL_UNIT_VERSION = "monthly-units-v2-solar";
export const communityFor = (code: string) => code === SOLAR_CODE ? "RE" : "AG";
export const minYearFor = (code: string) => code === SOLAR_CODE ? 1984 : MIN_YEAR;

export const normalizeLongitude = (lon: number) => ((lon + 180) % 360 + 360) % 360 - 180;

export function validatePeriod(start: number, end: number, code = "T2M"): string | null {
  const min = minYearFor(code);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > MAX_YEAR || start > MAX_YEAR || end < min)
    return `Years must be whole numbers between ${min} and ${MAX_YEAR}.`;
  if (!(end > start) || end - start < 7) return "Choose at least eight calendar years (e.g., 2005–2024).";
  return null;
}
export function validateCoords(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return "Latitude must be a number between −90 and 90.";
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return "Longitude must be a number between −180 and 180.";
  return null;
}
