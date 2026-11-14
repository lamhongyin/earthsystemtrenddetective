import type { AnnualData, Grid } from "./calculations";
export type Manifest = { version: string; preparedAt: string; years: number[]; grid: Grid; sources: { code: string; variable: string; service: string; unit: string; aggregation: string; nativeResolution: string; identities: { year: number; binarySha256: string }[] }[]; completeness: string; timeConvention: string; mask: string; method: string };
let cached: { data: AnnualData; manifest: Manifest } | undefined;
export async function loadHotspotData(signal: AbortSignal, onProgress: (message: string) => void) {
  if (cached) return cached;
  const response = await fetch("/hotspots/manifest.json", { signal });
  if (!response.ok || !response.headers.get("content-type")?.includes("json")) throw new Error("Prepared NASA annual data is unavailable. Retry shortly.");
  const manifest = await response.json() as Manifest, n = manifest.grid.width * manifest.grid.height;
  if (n > 250000 || manifest.years.length !== 20) throw new Error("Unexpected global dataset. No partial calculation is available.");
  const arrays: { temperature: Float32Array[]; rainfall: Float32Array[] } = { temperature: [], rainfall: [] };
  for (const code of ["T2M", "PRECTOTCORR"]) {
    const source = manifest.sources.find(s => s.code === code); if (!source) throw new Error("Missing NASA source mapping.");
    for (const year of manifest.years) {
      onProgress(`Loading ${code === "T2M" ? "temperature" : "rainfall"} annual grid ${year}…`);
      const res = await fetch(`/hotspots/${code}-${year}.bin`, { signal });
      if (!res.ok) throw new Error(`NASA prepared year ${year} is unavailable. No partial world result is shown.`);
      const bytes = await res.arrayBuffer(); if (bytes.byteLength !== n * 4) throw new Error("An annual grid is incomplete. Retry shortly.");
      const digest = await crypto.subtle.digest("SHA-256", bytes), hash = Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, "0")).join("");
      if (source.identities.find(i => i.year === year)?.binarySha256 !== hash) throw new Error("Annual grid verification failed. No candidates were calculated.");
      const values = new Float32Array(bytes); if (code === "T2M") arrays.temperature.push(values); else arrays.rainfall.push(values);
    }
  }
  const data: AnnualData = { ...arrays, grid: manifest.grid, years: manifest.years, version: manifest.version };
  cached = { data, manifest }; return cached;
}