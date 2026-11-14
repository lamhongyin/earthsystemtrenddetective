import { calculatePoint, geoElevation, REVISIONS, MODEL_VERSION, validateScenario, type Scenario, type ModelPoint } from "./model";
export const LOCAL_INPUTS = {
  rain: { name: "R001.TXT", hash: "360cc6fa81df0403ba00a881cc2e0d58cd67123187dd3244f79273bdb330e553", rows: 1441, cols: 2881, maxBytes: 40000000, spacing: .125, unit: "mm/h", southFirst: true, west: -180 },
  height: { name: "h0.txt", hash: "a94d7369568786fdc6de57eeddadab59202878cb415c882428b9b8230813cac3", rows: 121, cols: 241, maxBytes: 500000, spacing: 1.5, unit: "km ASL", southFirst: false, west: 0 },
} as const;
export type GridKind = keyof typeof LOCAL_INPUTS;
export type LocalGrids = { rain: Float64Array; height: Float64Array };
export type Extent = { west: number; east: number; south: number; north: number };
export type MapScenario = { link: Scenario; geometry: "reference" | "geo"; orbitalLongitudeDeg: number; minElevationDeg: number; extent: Extent; spacingDeg: number; intervalDb: number; marginDb: number | null };
export type EvaluatedPoint = ModelPoint & { lat: number; lon: number; h0KmAsl: number | null; headroomDb: number | null };
export type CurvePoint = { pPercent: number; attenuationDb: number | null; reason: string };
export type BandFeature = { type: "Feature"; properties: { lowerDb: number; upperDb: number | null; rainFadeAllowanceMeets: boolean | null }; geometry: { type: "Polygon"; coordinates: number[][][] } };
export type MapResult = { scenario: MapScenario; submittedAt: string; points: EvaluatedPoint[]; features: BandFeature[]; levels: number[]; columns: number; rows: number; validCount: number; reasons: Record<string, number>; provenance: ReturnType<typeof provenance> };
export function provenance(scenario: MapScenario, submittedAt: string) {
  return { calculationVersion: MODEL_VERSION + "-browser-local-v1", revisions: REVISIONS, localInputHashes: { R001: LOCAL_INPUTS.rain.hash, h0: LOCAL_INPUTS.height.hash }, sourceGrid: { R001: "0.125° south-to-north −90…90; −180…180 duplicated seam; mm/h", h0: "1.5° north-to-south 90…−90; 0…360 duplicated seam; km ASL" }, interpolation: "bilinear source-grid interpolation; piecewise-linear triangular contour interpolation; no filling of invalid cells", sourcePeriod: "GPCC V2015 land 1951–2000; ERA Interim water 1979–2014. P.839 source averaging dates not specified in supplement.", scenario, submittedAt, altitudeDatum: "assumed above mean sea level (ASL), no terrain substitution", representativeRainfall: "terrestrial hypothetical link centre; satellite earth station", pConvention: "pPercent=0.01 is 0.01%; fraction=pPercent/100", dataMode: "verified browser-local user-supplied files; source grids excluded from exports", rights: "Local processing is not a copyright grant; educational/personal use and calculated-output distribution remain subject to applicable ITU terms. No ITU endorsement.", availability: "rain-only; not overall system availability" };
}
export function validateMap(s: MapScenario) {
  const errors = { ...validateScenario(s.link) };
  const b = s.extent;
  if (![b.west, b.east, b.south, b.north].every(Number.isFinite) || b.west < -180 || b.east > 180 || b.south < -85 || b.north > 85 || b.west >= b.east || b.south >= b.north || b.east - b.west > 40 || b.north - b.south > 40) errors["extent"] = "Use west < east and south < north, within ±180° longitude and ±85° latitude, at most 40° per side; split dateline regions.";
  if (!Number.isFinite(s.spacingDeg) || s.spacingDeg < .125 || s.spacingDeg > 5) errors["spacingDeg"] = "Calculation spacing: 0.125°–5°; not finer than rainfall grid.";
  if (Math.ceil((b.east - b.west) / s.spacingDeg) * Math.ceil((b.north - b.south) / s.spacingDeg) > 4096) errors["spacingDeg"] = "At most 4,096 calculation cells; choose coarser spacing or smaller region.";
  if (!Number.isFinite(s.intervalDb) || s.intervalDb < 1 || s.intervalDb > 100) errors["intervalDb"] = "Contour interval: 1–100 dB (at most 64 bands).";
  if (s.marginDb !== null && (!Number.isFinite(s.marginDb) || s.marginDb < 0 || s.marginDb > 1000)) errors["marginDb"] = "Fade margin: 0–1000 dB, or leave empty.";
  if (s.link.mode === "satellite" && s.geometry === "geo") {
    delete errors["elevationDeg"]; // Fixed reference angle is not an input to GEO geometry.
    if (!Number.isFinite(s.orbitalLongitudeDeg) || Math.abs(s.orbitalLongitudeDeg) > 180) errors["orbitalLongitudeDeg"] = "GEO orbital longitude: −180° to 180°.";
    if (!Number.isFinite(s.minElevationDeg) || s.minElevationDeg < 0 || s.minElevationDeg > 90) errors["minElevationDeg"] = "Minimum operating elevation: 0°–90°.";
  }
  return errors;
}
export function bilinear(values: Float64Array, kind: GridKind, lat: number, lon: number): number | null {
  const m = LOCAL_INPUTS[kind];
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || values.length !== m.rows * m.cols) return null;
  const wrapped = ((lon - m.west) % 360 + 360) % 360;
  const x = wrapped / m.spacing, y = (m.southFirst ? lat + 90 : 90 - lat) / m.spacing;
  const ix = Math.min(Math.floor(x), m.cols - 2), iy = Math.min(Math.floor(y), m.rows - 2), fx = x - ix, fy = y - iy;
  const a = values[iy * m.cols + ix], b = values[iy * m.cols + ix + 1], c = values[(iy + 1) * m.cols + ix], d = values[(iy + 1) * m.cols + ix + 1];
  if (![a, b, c, d].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0)) return null;
  return (a ?? 0) * (1 - fx) * (1 - fy) + (b ?? 0) * fx * (1 - fy) + (c ?? 0) * (1 - fx) * fy + (d ?? 0) * fx * fy;
}
export function evaluate(grids: LocalGrids, s: MapScenario, lat: number, lon: number): EvaluatedPoint {
  const rain = bilinear(grids.rain, "rain", lat, lon), h0 = bilinear(grids.height, "height", lat, lon);
  let elevation = s.link.elevationDeg, mask = "";
  if (s.link.mode === "satellite" && s.geometry === "geo") {
    elevation = geoElevation(lat, lon, s.orbitalLongitudeDeg, s.link.altitudeKmAsl);
    if (elevation <= 0) mask = "geo_invisible";
    else if (elevation < s.minElevationDeg) mask = "below_minimum_elevation";
  }
  const result = calculatePoint({ ...s.link, elevationDeg: mask ? 1 : elevation }, lat, rain, h0 === null ? null : h0 + .36);
  return { ...result, ...(mask ? { valid: false, reason: mask, apDb: null, a001Db: null, effectivePathKm: null } : {}), elevationDeg: elevation, lat, lon, h0KmAsl: h0, headroomDb: !mask && result.apDb !== null && s.marginDb !== null ? s.marginDb - result.apDb : null };
}
export function pointCurve(grids: LocalGrids, s: MapScenario, lat: number, lon: number): CurvePoint[] {
  const maxP = s.link.mode === "satellite" ? 5 : 1;
  const ps = [...new Set([s.link.pPercent, .01, ...Array.from({ length: 61 }, (_, i) => 10 ** (-3 + i / 60 * (Math.log10(maxP) + 3)))])].sort((a, b) => a - b);
  return ps.map(pPercent => { const r = evaluate(grids, { ...s, link: { ...s.link, pPercent } }, lat, lon); return { pPercent, attenuationDb: r.apDb, reason: r.reason }; });
}
type Vertex = [number, number, number];
function clip(poly: Vertex[], boundary: number, above: boolean): Vertex[] {
  const result: Vertex[] = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]; if (!b) return;
    const inside = (v: Vertex) => above ? v[2] >= boundary : v[2] <= boundary;
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b)) { const t = (boundary - a[2]) / (b[2] - a[2]); result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), boundary]); }
  });
  return result;
}
// Isobands clipped independently inside valid grid-cell triangles. A cell with any invalid corner is left empty.
export function filledBands(points: EvaluatedPoint[], columns: number, rows: number, levels: number[], marginDb: number | null): BandFeature[] {
  const features: BandFeature[] = [];
  for (let y = 0; y < rows - 1; y++) for (let x = 0; x < columns - 1; x++) {
    const corners = [points[y * columns + x], points[y * columns + x + 1], points[(y + 1) * columns + x + 1], points[(y + 1) * columns + x]];
    if (corners.some(p => !p?.valid || p.apDb === null)) continue;
    const vertices = corners.map(p => [p?.lon ?? 0, p?.lat ?? 0, p?.apDb ?? 0] as Vertex);
    for (const indexes of [[0, 1, 2], [0, 2, 3]]) {
      const triangle = indexes.flatMap(i => vertices[i] ? [vertices[i] as Vertex] : []);
      for (let band = 0; band < levels.length; band++) {
        const lowerDb = levels[band] ?? 0, upperDb = levels[band + 1] ?? null;
        let polygon = clip(triangle, lowerDb, true); if (upperDb !== null) polygon = clip(polygon, upperDb, false);
        if (polygon.length < 3) continue;
        const area = Math.abs(polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + (b ? a[0] * b[1] - b[0] * a[1] : 0); }, 0));
        if (area < 1e-12) continue;
        const coordinates = polygon.map(p => [p[0], p[1]]); const first = coordinates[0]; if (first) coordinates.push([...first]);
        if (features.length >= 32768) throw new Error("Contour output exceeds 32,768 pieces; use a smaller region, coarser grid or larger contour interval.");
        features.push({ type: "Feature", properties: { lowerDb, upperDb, rainFadeAllowanceMeets: marginDb === null ? null : upperDb !== null && upperDb <= marginDb }, geometry: { type: "Polygon", coordinates: [coordinates] } });
      }
    }
  }
  return features;
}