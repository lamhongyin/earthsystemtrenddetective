// Offline numeric preparation; preserves source annual arrays for classification evidence.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fromArrayBuffer } from "geotiff";
import { annualMapValue, serviceFor, spatialParameter } from "../src/lib/spatial/data";
await mkdir("public/hotspots", { recursive: true });
const years = Array.from({ length: 20 }, (_, i) => 2005 + i), sources = [];
let grid: { width: number; height: number; west: number; north: number; dx: number; dy: number } | undefined;
for (const code of ["T2M", "PRECTOTCORR"] as const) {
  const p = spatialParameter(code), source = serviceFor(code, "annual");
  const response = await fetch(`${source}/multidimensionalInfo?f=json`);
  if (!response.ok) throw new Error("NASA metadata unavailable");
  const metadata = await response.json(), variable = metadata.multidimensionalInfo.variables.find((v: { name: string }) => v.name === p.variable);
  if (!variable || variable.unit !== (code === "T2M" ? "C" : "mm") || variable.attributes._FillValue !== -999) throw new Error("NASA mapping changed");
  const identities = [];
  for (const year of years) {
    const time = variable.dimensions[0].values.find((t: number) => new Date(t).getUTCFullYear() === year);
    if (time === undefined) throw new Error(`Missing source year ${year}`);
    const original = await readFile(`/tmp/spatial/annual/${code}-${year}.tif`);
    const image = await (await fromArrayBuffer(original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength))).getImage();
    const bounds = image.getBoundingBox(), width = image.getWidth(), height = image.getHeight();
    const current = { width, height, west: bounds[0], north: bounds[3], dx: (bounds[2] - bounds[0]) / width, dy: (bounds[3] - bounds[1]) / height };
    if (grid && JSON.stringify(grid) !== JSON.stringify(current)) throw new Error("Incompatible grids"); grid = current;
    const raw = (await image.readRasters())[0]; if (!raw) throw new Error("Missing numeric band");
    const values = Float32Array.from(raw as Float32Array, v => annualMapValue(v, code, year));
    const bytes = new Uint8Array(values.buffer), hash = Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
    await writeFile(`public/hotspots/${code}-${year}.bin`, bytes);
    identities.push({ year, time, originalTiffSha256: Buffer.from(await crypto.subtle.digest("SHA-256", original)).toString("hex"), binarySha256: hash });
  }
  sources.push({ code, variable: p.variable, service: source, unit: code === "T2M" ? "°C" : "mm/year", originalUnit: variable.unit, aggregation: variable.attributes.cell_methods, missing: -999, nativeResolution: p.native, identities });
}
await writeFile("public/hotspots/manifest.json", JSON.stringify({ version: "power-annual-hotspots-2005-2024-v1", preparedAt: new Date().toISOString(), years, grid, sources, completeness: "Source annual aggregation inherited from NASA; screening requires >=90% and >=15 valid annual values, valid first/last year, common temperature/rainfall eligibility", timeConvention: "Local solar time; source StdTime identifies period end", method: "OLS against actual calendar years, per-decade slope; no significance test", mask: "All valid cells, including oceans", binary: "Little-endian float32, row-major north to south; NaN denotes missing", sourceRetrieval: "Original TIFF retrieval/hashes recorded in public/spatial manifests; prepared binaries preserve annual source values" }, null, 2));
console.log("Prepared complete annual evidence for both variables, 2005–2024");