// Offline preparation only; never runs during a browser/server request.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fromArrayBuffer } from "geotiff";
import { annualMapValue, senPerDecade, serviceFor, spatialParameter, type SpatialCode } from "../src/lib/spatial/data";
const years = Array.from({ length: 20 }, (_, i) => 2005 + i);
const directory = "public/spatial";
await mkdir(directory, { recursive: true });
await mkdir("/tmp/spatial/annual", { recursive: true });
const codes: SpatialCode[] = process.argv.includes("--all") ? ["T2M", "PRECTOTCORR", "RH2M", "WS10M", "ALLSKY_SFC_SW_DWN"] : ["T2M"];
for (const code of codes) {
  const p = spatialParameter(code), source = serviceFor(code, "annual"), solar = code === "ALLSKY_SFC_SW_DWN";
  const meta = await (await fetch(`${source}/multidimensionalInfo?f=json`)).json();
  const variable = meta.multidimensionalInfo.variables.find((v: { name: string }) => v.name === p.variable);
  if (!variable) throw new Error("Missing verified variable");
  const grids: Float32Array[] = [], identities: { year: number; time: number; sha256: string }[] = [];
  let bounds: number[] = [], width = 0, height = 0;
  for (const year of years) {
    const time = variable.dimensions[0].values.find((t: number) => new Date(t).getUTCFullYear() === year);
    if (time === undefined) throw new Error(`Missing ${year}`);
    const params = new URLSearchParams({ f: "image", bbox: solar ? "-180,-90,180,90" : "-180.3125,-90.25,179.6875,90.25", bboxSR: "4326", imageSR: "4326", size: solar ? "360,180" : "576,361", adjustAspectRatio: "false", format: "tiff", pixelType: "F32", interpolation: "RSP_NearestNeighbor", mosaicRule: JSON.stringify({ multidimensionalDefinition: [{ variableName: p.variable, dimensionName: "StdTime", values: [time], isSlice: true }] }) });
    const filename = `/tmp/spatial/annual/${code}-${year}.tif`;
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(await readFile(filename)); } catch {
      const response = await fetch(`${source}/exportImage?${params}`, { signal: AbortSignal.timeout(120000) });
      if (!response.ok || !response.headers.get("content-type")?.includes("tiff")) throw new Error(`NASA failed ${code} ${year}`);
      bytes = new Uint8Array(await response.arrayBuffer()); await writeFile(filename, bytes);
    }
    const image = await (await fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)).getImage();
    width = image.getWidth(); height = image.getHeight(); bounds = image.getBoundingBox();
    const bands = await image.readRasters(); const raw = bands[0]; if (!raw) throw new Error("Missing numeric band");
    grids.push(Float32Array.from(raw as Float32Array, v => annualMapValue(v, code, year)));
    const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    identities.push({ year, time, sha256: Buffer.from(hash).toString("hex") });
    console.log("retrieved", code, year);
  }
  const count = width * height, slope = new Float32Array(count), average = new Float32Array(count), counts = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const values = grids.map(g => g[i] ?? NaN), result = senPerDecade(years, values);
    slope[i] = result.slope; counts[i] = result.count;
    average[i] = result.count === 20 ? values.reduce((a, b) => a + b, 0) / 20 : NaN;
  }
  await writeFile(`${directory}/${code}-trend.bin`, new Uint8Array(slope.buffer));
  await writeFile(`${directory}/${code}-average.bin`, new Uint8Array(average.buffer));
  await writeFile(`${directory}/${code}-counts.bin`, counts);
  const manifest = { code, variable: p.variable, source, sourceUnit: variable.unit, conversion: code === "PRECTOTCORR" ? "Annual accumulated source mm retained as mm/year; trends are change in annual total per decade" : p.conversion, nativeResolution: p.native, displayResolution: `${(bounds[2] - bounds[0]) / width}° longitude × ${(bounds[3] - bounds[1]) / height}° latitude`, width, height, west: bounds[0], north: bounds[3], dx: (bounds[2] - bounds[0]) / width, dy: (bounds[3] - bounds[1]) / height, years, retrievedAt: new Date().toISOString(), annualAggregation: variable.attributes.cell_methods, completeness: "20 of 20 finite annual source values; source annual completeness inherits NASA aggregation", estimator: "Median pairwise slope against actual calendar years × 10 (Sen slope per decade)", averageMethod: "Arithmetic mean of the 20 canonical annual values, equal weight per year", significance: "Not tested; little change is |slope| ≤ 0.1 °C/decade for temperature, not a significance claim", binary: "Little-endian float32, north-to-south rows; NaN is missing; counts uint8", identities, checks: [ { lat: 1.5, lon: 103.75 }, { lat: 51.5, lon: -0.125 }, { lat: -33.875, lon: 151.25 } ].map(point => {
    const x = Math.floor((point.lon - bounds[0]) / ((bounds[2] - bounds[0]) / width)), y = Math.floor((bounds[3] - point.lat) / ((bounds[3] - bounds[1]) / height)), i = y * width + x;
    return { ...point, values: grids.map(g => g[i]), slopePerDecade: slope[i], count: counts[i] };
  }) };
  await writeFile(`${directory}/${code}-manifest.json`, JSON.stringify(manifest, null, 2));
  console.log("prepared", code, count, "cells");
}