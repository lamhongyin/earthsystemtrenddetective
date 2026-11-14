export const MODEL_VERSION = "itu-rain-only-v1";
export const REVISIONS = { rainfall: "ITU-R P.837-8 (09/2025)", coefficients: "ITU-R P.838-3", height: "ITU-R P.839-4", satellite: "ITU-R P.618-14 §2.2.1.1", terrestrial: "ITU-R P.530-19 §2.4.1 and §2.4.2.1" };
export type Scenario = { mode: "satellite" | "terrestrial"; frequencyGHz: number; pPercent: number; polarization: "horizontal" | "vertical" | "circular"; elevationDeg: number; altitudeKmAsl: number; distanceKm: number; antenna1KmAsl: number; antenna2KmAsl: number };
export function validateScenario(s: Scenario) {
  const errors: Record<string, string> = {};
  const range = (key: keyof Scenario, min: number, max: number, label: string, exclusive = false) => {
    const v = s[key]; if (typeof v !== "number" || !Number.isFinite(v) || (exclusive ? v <= min : v < min) || v > max) errors[key] = `${label}: ${exclusive ? "greater than" : "at least"} ${min}, at most ${max}.`;
  };
  range("frequencyGHz", 1, s.mode === "satellite" ? 55 : 175, "Frequency (GHz)");
  range("pPercent", 0.001, s.mode === "satellite" ? 5 : 1, "Annual exceedance (%)");
  if (s.mode === "satellite") { range("elevationDeg", 0, 90, "Elevation (degrees)", true); range("altitudeKmAsl", -0.5, 20, "Station altitude (km ASL)"); }
  else { range("distanceKm", 0, 60, "Distance (km)", true); range("antenna1KmAsl", -0.5, 20, "First antenna altitude (km ASL)"); range("antenna2KmAsl", -0.5, 20, "Second antenna altitude (km ASL)"); }
  return errors;
}
const radians = (v: number) => v * Math.PI / 180;
const fit = (f: number, a: number[], b: number[], c: number[], m: number, offset: number) => a.reduce((sum, v, i) => sum + v * Math.exp(-(((Math.log10(f) - (b[i] ?? 0)) / (c[i] ?? 1)) ** 2)), 0) + m * Math.log10(f) + offset;
export function coefficients(frequencyGHz: number, elevationDeg: number, tiltDeg: number) {
  if (![frequencyGHz, elevationDeg, tiltDeg].every(Number.isFinite) || frequencyGHz < 1 || frequencyGHz > 1000) throw new Error("Unsupported P.838 inputs.");
  const kh = 10 ** fit(frequencyGHz, [-5.3398, -.35351, -.23789, -.94158], [-.10008, 1.2697, .86036, .64552], [1.13098, .454, .15354, .16817], -.18961, .71147);
  const kv = 10 ** fit(frequencyGHz, [-3.80595, -3.44965, -.39902, .50167], [.56934, -.22911, .73042, 1.07319], [.81061, .51059, .11899, .27195], -.16398, .63297);
  const ah = fit(frequencyGHz, [-.14318, .29591, .32177, -5.3761, 16.1721], [1.82442, .77564, .63773, -.9623, -3.2998], [-.55187, .19822, .13164, 1.47828, 3.4399], .67849, -1.95537);
  const av = fit(frequencyGHz, [-.07771, .56727, -.20238, -48.2991, 48.5833], [2.3384, .95545, 1.1452, .791669, .791459], [-.76284, .54039, .26809, .116226, .116479], -.053739, .83433);
  const factor = Math.cos(radians(elevationDeg)) ** 2 * Math.cos(2 * radians(tiltDeg));
  const k = (kh + kv + (kh - kv) * factor) / 2;
  return { k, alpha: (kh * ah + kv * av + (kh * ah - kv * av) * factor) / (2 * k), kh, kv, ah, av };
}
export type ModelPoint = { valid: boolean; reason: string; rainRateMmPerHour: number | null; rainHeightKmAsl: number | null; k: number | null; alpha: number | null; gammaDbKm: number | null; a001Db: number | null; apDb: number | null; effectivePathKm: number | null; elevationDeg: number; equation32?: { frequencyGHz: number; distanceKm: number; rainRateMmPerHour: number }; };
export function calculatePoint(s: Scenario, latitudeDeg: number, rainRateMmPerHour: number | null, rainHeightKmAsl: number | null): ModelPoint {
  const blank: ModelPoint = { valid: false, reason: "missing_climatology", rainRateMmPerHour, rainHeightKmAsl, k: null, alpha: null, gammaDbKm: null, a001Db: null, apDb: null, effectivePathKm: null, elevationDeg: s.elevationDeg };
  if (Object.keys(validateScenario(s)).length || !Number.isFinite(latitudeDeg) || Math.abs(latitudeDeg) > 90) return { ...blank, reason: "invalid_inputs" };
  if (rainRateMmPerHour === null || rainHeightKmAsl === null || !Number.isFinite(rainRateMmPerHour) || !Number.isFinite(rainHeightKmAsl) || rainRateMmPerHour < 0) return blank;
  const f = s.frequencyGHz, p = s.pPercent;
  const angle = s.mode === "satellite" ? s.elevationDeg : Math.atan2(s.antenna2KmAsl - s.antenna1KmAsl, s.distanceKm) * 180 / Math.PI;
  const c = coefficients(f, angle, s.polarization === "circular" ? 45 : s.polarization === "vertical" ? 90 : 0);
  const gammaDbKm = c.k * rainRateMmPerHour ** c.alpha;
  const base = { ...blank, ...c, gammaDbKm, elevationDeg: angle, valid: true, reason: "valid" };
  const zero = (reason: string): ModelPoint => ({ ...base, reason, a001Db: 0, apDb: 0, effectivePathKm: 0 });
  if (s.mode === "terrestrial") {
    if (Math.min(s.antenna1KmAsl, s.antenna2KmAsl) >= rainHeightKmAsl + 2.4) return zero("above_precipitation_path");
    if (Math.max(s.antenna1KmAsl, s.antenna2KmAsl) > rainHeightKmAsl - 3.6) return { ...base, valid: false, reason: "combined_wet_snow_model_required" };
  } else if (s.altitudeKmAsl >= rainHeightKmAsl) return zero("above_rain_path");
  if (rainRateMmPerHour === 0) return zero("zero_rainfall");
  let effectivePathKm: number, apDb: number, a001Db: number;
  if (s.mode === "terrestrial") {
    const equation32 = { frequencyGHz: Math.max(f, 6), distanceKm: Math.min(s.distanceKm, 30), rainRateMmPerHour: Math.max(rainRateMmPerHour, 3) };
    const d = equation32.distanceKm;
    const r = 1 / (.477 * d ** .633 * equation32.rainRateMmPerHour ** (.073 * c.alpha) * equation32.frequencyGHz ** .123 - 10.579 * (1 - Math.exp(-.024 * d)));
    effectivePathKm = s.distanceKm * r; a001Db = gammaDbKm * effectivePathKm;
    const c0 = f >= 10 ? .12 + .4 * Math.log10(f / 10) ** .8 : .12;
    const c1 = .07 ** c0 * .12 ** (1 - c0), c2 = .855 * c0 + .546 * (1 - c0), c3 = .139 * c0 + .043 * (1 - c0);
    apDb = p === .01 ? a001Db : a001Db * c1 * p ** (-(c2 + c3 * Math.log10(p)));
    return [effectivePathKm, a001Db, apDb].every(v => Number.isFinite(v) && v >= 0) ? { ...base, effectivePathKm, a001Db, apDb, equation32 } : { ...blank, reason: "nonfinite_model_output" };
  }
  const theta = radians(s.elevationDeg), deltaH = rainHeightKmAsl - s.altitudeKmAsl;
  const ls = s.elevationDeg >= 5 ? deltaH / Math.sin(theta) : 2 * deltaH / (Math.sqrt(Math.sin(theta) ** 2 + 2 * deltaH / 8500) + Math.sin(theta));
  const lg = ls * Math.cos(theta);
  const r = 1 / (1 + .78 * Math.sqrt(lg * gammaDbKm / f) - .38 * (1 - Math.exp(-2 * lg)));
  const zeta = Math.atan2(deltaH, lg * r);
  const lr = zeta > theta ? lg * r / Math.cos(theta) : deltaH / Math.sin(theta);
  const chi = Math.max(0, 36 - Math.abs(latitudeDeg));
  const v = 1 / (1 + Math.sqrt(Math.sin(theta)) * (31 * (1 - Math.exp(-s.elevationDeg / (1 + chi))) * Math.sqrt(lr * gammaDbKm) / f ** 2 - .45));
  effectivePathKm = lr * v; a001Db = gammaDbKm * effectivePathKm;
  const beta = p >= 1 || Math.abs(latitudeDeg) >= 36 ? 0 : -.005 * (Math.abs(latitudeDeg) - 36) + (s.elevationDeg >= 25 ? 0 : 1.8 - 4.25 * Math.sin(theta));
  apDb = p === .01 ? a001Db : a001Db * (p / .01) ** (-(.655 + .033 * Math.log(p) - .045 * Math.log(a001Db) - beta * (1 - p) * Math.sin(theta)));
  return [effectivePathKm, a001Db, apDb].every(v => Number.isFinite(v) && v >= 0) ? { ...base, effectivePathKm, a001Db, apDb } : { ...blank, reason: "nonfinite_model_output" };
}
// WGS84 ECEF station -> GEO orbit: orbital geometry does not use propagation's 8500-km effective radius.
export function geoElevation(latitudeDeg: number, longitudeDeg: number, orbitalLongitudeDeg: number, altitudeKmAsl: number) {
  const lat = radians(latitudeDeg), lon = radians(longitudeDeg), orbit = radians(orbitalLongitudeDeg), e2 = .0066943799901413165;
  const n = 6378.137 / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const x = (n + altitudeKmAsl) * Math.cos(lat) * Math.cos(lon), y = (n + altitudeKmAsl) * Math.cos(lat) * Math.sin(lon), z = (n * (1 - e2) + altitudeKmAsl) * Math.sin(lat);
  const dx = 42164 * Math.cos(orbit) - x, dy = 42164 * Math.sin(orbit) - y, dz = -z;
  const up = dx * Math.cos(lat) * Math.cos(lon) + dy * Math.cos(lat) * Math.sin(lon) + dz * Math.sin(lat);
  return Math.asin(up / Math.hypot(dx, dy, dz)) * 180 / Math.PI;
}