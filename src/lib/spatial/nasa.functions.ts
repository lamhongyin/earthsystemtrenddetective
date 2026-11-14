import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serviceFor, spatialParameter, type SpatialCode } from "./data";

const Input = z.object({ code: z.enum(["T2M", "PRECTOTCORR", "RH2M", "WS10M", "ALLSKY_SFC_SW_DWN"]), mode: z.enum(["annual", "monthly"]), year: z.number().int().min(1981).max(2025), month: z.number().int().min(1).max(12) });
type Success = { ok: true; tiff: string; source: string; time: number; retrievedAt: string; unit: string; aggregation: string; first: number; last: number };
const cache = new Map<string, { at: number; result: Success }>();
export const fetchSpatialSlice = createServerFn({ method: "POST" }).inputValidator((d: unknown) => Input.parse(d)).handler(async ({ data }): Promise<Success | { ok: false; error: string }> => {
  const key = JSON.stringify(data), hit = cache.get(key);
  if (hit && Date.now() - hit.at < 86400_000) return hit.result;
  try {
    const p = spatialParameter(data.code as SpatialCode), source = serviceFor(data.code, data.mode);
    const metaResponse = await fetch(`${source}/multidimensionalInfo?f=json`, { signal: AbortSignal.timeout(30000) });
    if (!metaResponse.ok) throw new Error("NASA metadata is unavailable. Retry shortly.");
    const metadata = await metaResponse.json() as { multidimensionalInfo?: { variables: { name: string; unit: string; attributes: { cell_methods?: string; _FillValue?: number }; dimensions: { values: number[] }[] }[] } };
    const variable = metadata.multidimensionalInfo?.variables.find(v => v.name === p.variable);
    const expected = data.code === "T2M" ? "C" : data.code === "PRECTOTCORR" ? "mm" : data.code === "RH2M" ? "%" : data.code === "WS10M" ? "m/s" : "W m-2";
    if (!variable || variable.unit !== expected || variable.attributes._FillValue !== -999) throw new Error("NASA source metadata changed. This layer needs re-verification.");
    const times = variable.dimensions[0]?.values ?? [];
    const time = times.find(t => { const d = new Date(t); return d.getUTCFullYear() === data.year && (data.mode === "annual" || d.getUTCMonth() + 1 === data.month); });
    if (time === undefined) throw new Error("The requested period is not available in this NASA layer.");
    const solar = data.code === "ALLSKY_SFC_SW_DWN";
    const bbox = solar ? "-180,-90,180,90" : "-180.3125,-90.25,179.6875,90.25";
    const params = new URLSearchParams({ f: "image", bbox, bboxSR: "4326", imageSR: "4326", size: solar ? "360,180" : "576,361", adjustAspectRatio: "false", format: "tiff", pixelType: "F32", interpolation: "RSP_NearestNeighbor", mosaicRule: JSON.stringify({ multidimensionalDefinition: [{ variableName: p.variable, dimensionName: "StdTime", values: [time], isSlice: true }] }) });
    const res = await fetch(`${source}/exportImage?${params}`, { signal: AbortSignal.timeout(90000) });
    if (!res.ok || !res.headers.get("content-type")?.includes("tiff")) throw new Error("NASA could not provide this raster. Retry shortly.");
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 2000000 || bytes.length < 100) throw new Error("NASA returned an unexpected raster size.");
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const result: Success = { ok: true, tiff: btoa(binary), source, time, retrievedAt: new Date().toISOString(), unit: variable.unit, aggregation: variable.attributes.cell_methods ?? "unknown", first: new Date(times[0] ?? time).getUTCFullYear(), last: new Date(times.at(-1) ?? time).getUTCFullYear() };
    if (cache.size >= 8) { const oldest = cache.keys().next().value; if (oldest) cache.delete(oldest); }
    cache.set(key, { at: Date.now(), result });
    return result;
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "NASA spatial data is unavailable. Retry shortly." }; }
});