export const CALCULATION_VERSION = "hotspot-ols-area-v1";
export type Bounds = { west: number; east: number; south: number; north: number };
export type Grid = { width: number; height: number; west: number; north: number; dx: number; dy: number };
export type Mode = "warming" | "drying" | "combined";
export type Settings = { mode: Mode; bounds: Bounds; start: number; end: number; threshold: 5 | 10 | 20; mask: "all-valid" };
export type AnnualData = { grid: Grid; years: number[]; temperature: Float32Array[]; rainfall: Float32Array[]; version: string };
export type Fit = { slope: number; mean: number; count: number; intercept: number; rSquared: number };
export type Area = { id: number; cells: number; km2: number; temperature: number; rainfall: number; strongestTemperature: number; strongestRainfall: number; meanRainfall: number; representative: number; minimumYears: number };
export type Result = { settings: Settings; key: string; grid: Grid; eligible: number; excluded: number; inArea: number; candidateCount: number; eligibleKm2: number; candidateKm2: number; warmingCutoff: number | null; dryingCutoff: number | null; warnings: string[]; temperature: Float64Array; rainfall: Float64Array; temperatureMean: Float64Array; rainfallMean: Float64Array; temperatureCount: Uint8Array; rainfallCount: Uint8Array; membership: Int32Array; areas: Area[]; completedAt: string };
export function validateSettings(s: Settings, availableYears: number[]) {
  if (!Number.isInteger(s.start) || !Number.isInteger(s.end) || s.end - s.start + 1 < 15) throw new Error("Choose at least 15 calendar years.");
  if (!availableYears.includes(s.start) || !availableYears.includes(s.end)) throw new Error("Prepared NASA data covers 2005–2024. Choose a period within that range.");
  if (![5, 10, 20].includes(s.threshold)) throw new Error("Choose a 5%, 10% or 20% threshold.");
  const b = s.bounds;
  if (![b.west, b.east, b.south, b.north].every(Number.isFinite) || b.south < -90 || b.north > 90 || b.south >= b.north || b.west < -180 || b.west > 180 || b.east < -180 || b.east > 180 || b.west === b.east) throw new Error("Choose a valid study rectangle; west greater than east crosses the date line.");
}
export function fitAnnual(years: number[], values: number[]): Fit | null {
  const valid = years.map((year, i) => ({ year, value: values[i] })).filter((p): p is { year: number; value: number } => p.value !== undefined && Number.isFinite(p.value));
  if (years.length < 15 || valid.length < 15 || valid.length < Math.ceil(years.length * 0.9) || !Number.isFinite(values[0]) || !Number.isFinite(values.at(-1))) return null;
  const mx = valid.reduce((sum, p) => sum + p.year, 0) / valid.length, my = valid.reduce((sum, p) => sum + p.value, 0) / valid.length;
  let xx = 0, xy = 0, yy = 0;
  for (const p of valid) { xx += (p.year - mx) ** 2; xy += (p.year - mx) * (p.value - my); yy += (p.value - my) ** 2; }
  if (xx === 0) return null;
  const perYear = xy / xx;
  return { slope: perYear * 10, mean: my, count: valid.length, intercept: my - perYear * mx, rSquared: yy === 0 ? 0 : Math.min(1, xy * xy / (xx * yy)) };
}
export function cellBounds(grid: Grid, index: number): Bounds {
  const x = index % grid.width, y = Math.floor(index / grid.width);
  return { west: grid.west + x * grid.dx, east: grid.west + (x + 1) * grid.dx, north: Math.min(90, grid.north - y * grid.dy), south: Math.max(-90, grid.north - (y + 1) * grid.dy) };
}
export function cellCentre(grid: Grid, index: number) {
  const b = cellBounds(grid, index), raw = (b.west + b.east) / 2;
  return { lat: (b.south + b.north) / 2, lon: ((raw + 180) % 360 + 360) % 360 - 180 };
}
export function cellAreaKm2(b: Bounds) { return 6371.0088 ** 2 * Math.abs((b.east - b.west) * Math.PI / 180) * Math.abs(Math.sin(b.north * Math.PI / 180) - Math.sin(b.south * Math.PI / 180)); }
export function inside(lat: number, lon: number, b: Bounds) { return lat >= b.south && lat <= b.north && (b.west < b.east ? lon >= b.west && lon <= b.east : lon >= b.west || lon <= b.east); }
// Inverse empirical CDF: first value whose cumulative positive area weight reaches q × total weight. Ties are inclusive.
export function weightedQuantile(entries: { value: number; weight: number }[], q: number): number | null {
  const sorted = entries.filter(p => Number.isFinite(p.value) && Number.isFinite(p.weight) && p.weight > 0).sort((a, b) => a.value - b.value);
  if (!sorted.length) return null;
  const target = sorted.reduce((sum, p) => sum + p.weight, 0) * q; let cumulative = 0;
  for (const p of sorted) { cumulative += p.weight; if (cumulative >= target) return p.value; }
  return sorted.at(-1)?.value ?? null;
}
export function candidateRules(temperature: number, rainfall: number, warmingCutoff: number | null, dryingCutoff: number | null) {
  return { warming: warmingCutoff !== null && temperature > 0 && temperature >= warmingCutoff, drying: dryingCutoff !== null && rainfall < 0 && rainfall <= dryingCutoff };
}
export function analysisKey(s: Settings, version: string) { return JSON.stringify({ version, calculation: CALCULATION_VERSION, ...s }); }
export function isCurrentResult(expected: string, received: string) { return expected === received; }
export function connectedCells(flags: Uint8Array, grid: Grid) {
  const membership = new Int32Array(flags.length), groups: number[][] = [];
  for (let i = 0; i < flags.length; i++) {
    if (!flags[i] || membership[i]) continue;
    const id = groups.length + 1, queue = [i]; membership[i] = id;
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head]; if (cell === undefined) continue;
      const x = cell % grid.width, y = Math.floor(cell / grid.width);
      const neighbours = [y * grid.width + (x + grid.width - 1) % grid.width, y * grid.width + (x + 1) % grid.width, ...(y > 0 ? [cell - grid.width] : []), ...(y < grid.height - 1 ? [cell + grid.width] : [])];
      for (const next of neighbours) if (flags[next] && !membership[next]) { membership[next] = id; queue.push(next); }
    }
    groups.push(queue);
  }
  return { membership, groups };
}
export function calculateHotspots(data: AnnualData, settings: Settings, progress?: (value: number) => void): Result {
  validateSettings(settings, data.years);
  const grid = data.grid, n = grid.width * grid.height;
  if (n > 250000 || data.temperature.length !== data.years.length || data.rainfall.length !== data.years.length || [...data.temperature, ...data.rainfall].some(a => a.length !== n)) throw new Error("Incomplete or incompatible global arrays. No partial results were calculated.");
  const selected = data.years.map((year, i) => ({ year, i })).filter(p => p.year >= settings.start && p.year <= settings.end), years = selected.map(p => p.year);
  if (years.length !== settings.end - settings.start + 1) throw new Error("The requested annual batch is incomplete.");
  const temperature = new Float64Array(n).fill(NaN), rainfall = new Float64Array(n).fill(NaN), temperatureMean = new Float64Array(n).fill(NaN), rainfallMean = new Float64Array(n).fill(NaN), temperatureCount = new Uint8Array(n), rainfallCount = new Uint8Array(n), weights = new Float64Array(n);
  const tEntries: { value: number; weight: number }[] = [], rEntries: { value: number; weight: number }[] = [];
  let inArea = 0, eligibleKm2 = 0;
  for (let i = 0; i < n; i++) {
    const centre = cellCentre(grid, i); if (!inside(centre.lat, centre.lon, settings.bounds)) continue;
    inArea++;
    const tValues = selected.map(p => data.temperature[p.i]?.[i] ?? NaN), rValues = selected.map(p => data.rainfall[p.i]?.[i] ?? NaN);
    temperatureCount[i] = tValues.filter(Number.isFinite).length; rainfallCount[i] = rValues.filter(Number.isFinite).length;
    const t = fitAnnual(years, tValues), r = fitAnnual(years, rValues); if (!t || !r) continue;
    const weight = cellAreaKm2(cellBounds(grid, i)); if (weight <= 0) continue;
    temperature[i] = t.slope; rainfall[i] = r.slope; temperatureMean[i] = t.mean; rainfallMean[i] = r.mean; weights[i] = weight; eligibleKm2 += weight;
    tEntries.push({ value: t.slope, weight }); rEntries.push({ value: r.slope, weight });
    if (i % 4096 === 0) progress?.(Math.round(i / n * 65));
  }
  const warnings: string[] = [], eligible = tEntries.length;
  const variation = (entries: { value: number }[]) => { let low = Infinity, high = -Infinity; for (const p of entries) { low = Math.min(low, p.value); high = Math.max(high, p.value); } return high - low; };
  if (eligible < 2) warnings.push("Too few jointly eligible cells to rank this area.");
  const tVariable = eligible >= 2 && variation(tEntries) > 1e-10, rVariable = eligible >= 2 && variation(rEntries) > 1e-10;
  if (!tVariable) warnings.push("Temperature slopes have insufficient spatial variation; no warming group can be distinguished.");
  if (!rVariable) warnings.push("Rainfall slopes have insufficient spatial variation; no drying group can be distinguished.");
  const warmingCutoff = tVariable ? weightedQuantile(tEntries, 1 - settings.threshold / 100) : null, dryingCutoff = rVariable ? weightedQuantile(rEntries, settings.threshold / 100) : null;
  const flags = new Uint8Array(n); let candidateCount = 0, candidateKm2 = 0;
  for (let i = 0; i < n; i++) {
    if (!weights[i]) continue;
    const c = candidateRules(temperature[i] ?? NaN, rainfall[i] ?? NaN, warmingCutoff, dryingCutoff);
    const candidate = settings.mode === "warming" ? c.warming : settings.mode === "drying" ? c.drying : c.warming && c.drying;
    if (candidate) { flags[i] = 1; candidateCount++; candidateKm2 += weights[i] ?? 0; }
  }
  progress?.(75);
  const { membership, groups } = connectedCells(flags, grid);
  const areas: Area[] = groups.map((cells, i) => {
    let km2 = 0, t = 0, r = 0, meanR = 0, strongestTemperature = -Infinity, strongestRainfall = Infinity, minimumYears = 255;
    for (const cell of cells) { const w = weights[cell] ?? 0; km2 += w; t += (temperature[cell] ?? 0) * w; r += (rainfall[cell] ?? 0) * w; meanR += (rainfallMean[cell] ?? 0) * w; strongestTemperature = Math.max(strongestTemperature, temperature[cell] ?? -Infinity); strongestRainfall = Math.min(strongestRainfall, rainfall[cell] ?? Infinity); minimumYears = Math.min(minimumYears, temperatureCount[cell] ?? 0, rainfallCount[cell] ?? 0); }
    return { id: i + 1, cells: cells.length, km2, temperature: t / km2, rainfall: r / km2, meanRainfall: meanR / km2, strongestTemperature, strongestRainfall, representative: cells[0] ?? 0, minimumYears };
  });
  progress?.(100);
  return { settings: structuredClone(settings), key: analysisKey(settings, data.version), grid, eligible, excluded: inArea - eligible, inArea, eligibleKm2, candidateCount, candidateKm2, warmingCutoff, dryingCutoff, warnings, temperature, rainfall, temperatureMean, rainfallMean, temperatureCount, rainfallCount, membership, areas, completedAt: new Date().toISOString() };
}