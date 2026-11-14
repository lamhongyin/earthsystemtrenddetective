import { ERDDAP, OCEAN_SOURCES, axisIndices, decodeOcean, monthRange, oceanMean, cellWeight, validateOceanTarget, daysInMonth, type OceanCode, type OceanMetadata, type OceanRow, type OceanTarget, type OceanRecord } from "./data";
const cache = new Map<string, { expires: number; value: unknown }>();
let active = 0;
async function cached<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = cache.get(key); if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await run(); if (cache.size >= 24) cache.delete(cache.keys().next().value ?? ""); cache.set(key, { expires: Date.now() + 3600_000, value }); return value;
}
async function sourceFetch(path: string, limit = 5_000_000) {
  if (active >= 3) throw new Error("Ocean requests are busy. Wait for the current request before retrying.");
  active++;
  try {
    const r = await fetch(`${ERDDAP}/${path}`, { signal: AbortSignal.timeout(60_000), redirect: "error" });
    if (!r.ok) { const wait = r.headers.get("Retry-After"); throw new Error(r.status === 429 || r.status === 503 ? `NOAA is temporarily busy. ${wait ? `Wait ${wait} seconds` : "Wait at least one minute"} before retrying.` : "NOAA could not return the requested ocean subset."); }
    const reader = r.body?.getReader(); if (!reader) throw new Error("NOAA returned an empty response.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new Error("Ocean response exceeded the bounded request size. Choose a smaller region or period."); } chunks.push(value); }
    const result = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; } return result;
  } catch (e) { if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new Error("NOAA took too long to return ocean data. Retry later; no substitute values have been used."); throw e; }
  finally { active--; }
}
const text = async (path: string) => new TextDecoder().decode(await sourceFetch(path));
const query = (q: string) => encodeURIComponent(q).replace(/%2C/g, ",");
export async function oceanMetadata(code: OceanCode): Promise<OceanMetadata> {
  const s = OCEAN_SOURCES[code];
  return cached(`meta:${code}`, async () => {
    const info = JSON.parse(await text(`info/${s.id}/index.json`)) as { table: { rows: string[][] } };
    const attr = (variable: string, name: string) => info.table.rows.find(r => r[0] === "attribute" && r[1] === variable && r[2] === name)?.[4] ?? "";
    const unit = attr(s.variable, "units"); if (unit !== s.originalUnit) throw new Error("NOAA ocean units changed; verification is required before displaying data.");
    const csv = await text(`griddap/${s.id}.csv?time`);
    const times = csv.trim().split(/\r?\n/).slice(2).filter(t => /^\d{4}-\d{2}-\d{2}T/.test(t));
    if (!times.length) throw new Error("Ocean source dates are unavailable.");
    const spacing = (variable: string) => Number((info.table.rows.find(r => r[0] === "dimension" && r[1] === variable)?.[4] ?? "").split("averageSpacing=")[1]);
    const range = (v: string) => attr(v, "actual_range").split(",").map(Number);
    const lat = range("latitude"), lon = range("longitude");
    const latFirst = spacing("latitude") < 0 ? lat[1] : lat[0], latLast = spacing("latitude") < 0 ? lat[0] : lat[1];
    if (latFirst === undefined || latLast === undefined || lon[0] === undefined || lon[1] === undefined) throw new Error("Ocean grid metadata is incomplete.");
    return { id: s.id, title: attr("NC_GLOBAL", "title"), summary: attr("NC_GLOBAL", "summary"), start: times[0] ?? "", end: times.at(-1) ?? "", times, unit, version: attr("NC_GLOBAL", "processing_version") || "MUR fv04.1 / NOAA monthly derivative", latFirst, latLast, lonFirst: lon[0], lonLast: lon[1], resolution: s.resolution, retrievedAt: new Date().toISOString() };
  });
}
async function numeric(code: OceanCode, target: OceanTarget, start: number, end: number) {
  const metadata = await oceanMetadata(code), s = OCEAN_SOURCES[code];
  const selected = metadata.times.map((t, i) => ({ t, i })).filter(({ t }) => Number(t.slice(0, 4)) >= start && Number(t.slice(0, 4)) <= end);
  if (!selected.length) throw new Error("No source months exist in the requested years.");
  const first = selected[0], last = selected.at(-1); if (!first || !last) throw new Error("No ocean dates available.");
  let spatial: string;
  if (target.bounds) {
    const b = target.bounds;
    const lat = axisIndices(metadata.latFirst, metadata.latLast, s.resolution, b.south - s.resolution / 2, b.north + s.resolution / 2);
    const lon = axisIndices(metadata.lonFirst, metadata.lonLast, s.resolution, b.west - s.resolution / 2, b.east + s.resolution / 2);
    if (lat.end < lat.start || lon.end < lon.start || (lat.end - lat.start + 1) * (lon.end - lon.start + 1) * selected.length > 65_000) throw new Error("Ocean region request is too large.");
    spatial = `[${lat.start}:1:${lat.end}][${lon.start}:1:${lon.end}]`;
  } else spatial = `[(${target.lat})][(${target.lon})]`;
  const slice = `[${first.i}:1:${last.i}]${spatial}`;
  const q = code === "sst" ? `sst${slice},mask${slice},nobs${slice}` : `chlor_a${slice}`;
  const csv = await text(`griddap/${s.id}.csv?${query(q)}`), lines = csv.trim().split(/\r?\n/), headers = lines[0]?.split(",") ?? [];
  const rows: OceanRow[] = lines.slice(2).map(line => {
    const c = line.split(","), get = (name: string) => c[headers.indexOf(name)] ?? "";
    const raw = Number(get(s.variable));
    return { time: get("time"), lat: Number(get("latitude")), lon: Number(get("longitude")), value: decodeOcean(raw, metadata.unit, code === "sst" ? -999 : NaN, code === "sst" ? -8 : 0.001, code === "sst" ? 58 : 100), ...(code === "sst" ? { mask: Number(get("mask")), nobs: Number(get("nobs")) } : {}) };
  });
  return { rows, metadata, sourceUrl: `${ERDDAP}/griddap/${s.id}.html` };
}
export async function oceanHistory(target: OceanTarget, start: number, end: number): Promise<OceanRecord[]> {
  validateOceanTarget(target);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 2002 || end < start || end - start > 24 || end > new Date().getUTCFullYear()) throw new Error("Choose between 2002 and the current year, with at most 25 years per request.");
  return cached(`history:${JSON.stringify({ target, start, end })}`, async () => {
    const sst = await numeric("sst", target, start, end), chl = await numeric("chlorophyll", target, start, end);
    const months = monthRange(start, end), fixedSea = new Map<string, { lat: number; lon: number }>();
    // The first available MUR month defines a fixed open-sea population. Ice/lake/land excluded.
    const reference = sst.rows[0]?.time;
    for (const r of sst.rows.filter(r => r.time === reference && r.mask === 1)) fixedSea.set(`${r.lat},${r.lon}`, r);
    return ([['sst', sst], ['chlorophyll', chl]] as const).map(([code, source]) => {
      const eligible = new Map<string, number>();
      const unique = new Map(source.rows.map(r => [`${r.lat},${r.lon}`, r]));
      for (const [key, r] of unique) {
        const nearest = [...fixedSea.values()].sort((a, b) => (a.lat-r.lat)**2+(a.lon-r.lon)**2-((b.lat-r.lat)**2+(b.lon-r.lon)**2))[0];
        const sea = code === "sst" ? fixedSea.has(key) : !!nearest && Math.abs(nearest.lat-r.lat) <= 0.016 && Math.abs(nearest.lon-r.lon) <= 0.016;
        if (sea) eligible.set(key, target.bounds ? cellWeight(r.lat, r.lon, OCEAN_SOURCES[code].resolution, target.bounds) : 1);
      }
      const monthly = oceanMean(source.rows, eligible, months, code);
      return { code, target, cell: source.rows[0] ? { lat: source.rows[0].lat, lon: source.rows[0].lon } : null, months: monthly, metadata: source.metadata, sourceUrl: source.sourceUrl, retrievedAt: new Date().toISOString(), maskMethod: "Fixed open-sea mask from first available MUR month; chlorophyll cells matched to nearest MUR mask cell (≤0.016° each axis). Ice, lakes and land excluded. Region weights use clipped spherical cell area; not observation-count weighting. MUR requires ≥80% daily nobs; monthly region requires ≥70% valid eligible area." };
    });
  });
}
export async function oceanImage(code: OceanCode, month: string) {
  const m = await oceanMetadata(code), s = OCEAN_SOURCES[code], i = m.times.findIndex(t => t.startsWith(month));
  if (i < 0) throw new Error("This source has no composite for the selected month.");
  return cached(`image:${code}:${month}`, async () => {
    const stride = code === "sst" ? 40 : 10;
    const q = `${s.variable}[${i}][0:${stride}:${code === "sst" ? 17998 : 4319}][0:${stride}:${code === "sst" ? 35999 : 8639}]`;
    const path = `griddap/${s.id}.transparentPng?${query(q)}&.draw=surface&.vars=longitude%7Clatitude%7C${s.variable}&.colorBar=Rainbow%7CC%7C${code === "chlorophyll" ? "Log" : "Linear"}%7C${s.low}%7C${s.high}&.size=960%7C480`;
    const bytes = await sourceFetch(path, 2_000_000);
    if (bytes[0] !== 137 || bytes[1] !== 80) throw new Error("NOAA did not return a valid ocean image.");
    const dy = s.resolution * stride, dx = dy;
    const latEnd = m.latFirst + Math.floor((code === "sst" ? 17998 : 4319) / stride) * dy * (code === "sst" ? 1 : -1);
    const lonEnd = m.lonFirst + Math.floor((code === "sst" ? 35999 : 8639) / stride) * dx;
    return { image: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`, month, sourceTime: m.times[i] ?? "", retrievedAt: new Date().toISOString(), bounds: { south: Math.max(-90, Math.min(m.latFirst, latEnd)-dy/2), north: Math.min(90, Math.max(m.latFirst,latEnd)+dy/2), west: Math.max(-180,m.lonFirst-dx/2), east: Math.min(180,lonEnd+dx/2) }, spacing: dy, metadata: m };
  });
}