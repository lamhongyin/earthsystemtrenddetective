import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { fromArrayBuffer } from "geotiff";
import { ChevronLeft, ChevronRight, Expand, Globe2, Loader2, MapPin, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchSpatialSlice } from "@/lib/spatial/nasa.functions";
import { canonicalValue, cellAt, spatialParameter, SPATIAL_PARAMETERS, sliceLabel, type Raster, type Slice, type SpatialCode, type SpatialMode } from "@/lib/spatial/data";
import type { Point } from "@/lib/trend/comparison";
const CanvasMap = lazy(() => import("./SpatialCanvasMap"));
const rasterCache = new Map<string, Raster>();
export function SpatialMapPanel({ a, b, compare, onUse, onHistory }: { a: Point; b: Point; compare: boolean; onUse: (id: "A" | "B", point: Point) => void; onHistory: (point: Point, code: SpatialCode) => void }) {
 const [draft, setDraft] = useState<Slice>({ code: "T2M", mode: "annual", year: 2025, month: 1 }), [raster, setRaster] = useState<Raster | null>(null);
 const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [opacity, setOpacity] = useState(75), [view, setView] = useState("world"), [grid, setGrid] = useState(false), [play, setPlay] = useState(false);
 const [selected, setSelected] = useState<{ lat: number; lon: number } | null>(null), [products, setProducts] = useState<SpatialCode[]>([]);
 const request = useRef(0), container = useRef<HTMLDivElement>(null), fetchSlice = useServerFn(fetchSpatialSlice);
 const param = spatialParameter(draft.code), shownParam = spatialParameter(raster?.slice.code ?? draft.code);
 const stale = !!raster && JSON.stringify(raster.slice) !== JSON.stringify(draft);
 useEffect(() => { void load(draft); Promise.all(SPATIAL_PARAMETERS.map(async p => { const response = await fetch(`/spatial/${p.code}-manifest.json`); return response.ok && response.headers.get("content-type")?.includes("json") ? p.code : null; })).then(values => setProducts(values.filter((v): v is SpatialCode => v !== null))); return () => { request.current++; }; }, []);
 async function load(s: Slice) {
  const id = ++request.current; setBusy(true); setError(null);
  try {
   const key = JSON.stringify(s); let result = rasterCache.get(key);
   if (!result) {
    if (s.mode === "trend" || s.mode === "average") {
     const responses = await Promise.all([fetch(`/spatial/${s.code}-manifest.json`), fetch(`/spatial/${s.code}-${s.mode}.bin`), fetch(`/spatial/${s.code}-counts.bin`)]);
     const [meta, data, count] = responses;
     if (!meta?.ok || !data?.ok || !count?.ok) throw new Error("This global product is not ready. Annual and monthly maps remain available.");
     const manifest = await meta.json(), bytes = await data.arrayBuffer(), counts = await count.arrayBuffer();
     result = { ...manifest, values: new Float32Array(bytes), counts: new Uint8Array(counts), slice: s };
    } else {
     const response = await fetchSlice({ data: { ...s, mode: s.mode } });
     if (!response.ok) throw new Error(response.error);
     const bytes = Uint8Array.from(atob(response.tiff), c => c.charCodeAt(0));
     const image = await (await fromArrayBuffer(bytes.buffer)).getImage(); const bands = await image.readRasters(), raw = bands[0];
     if (!raw) throw new Error("NASA returned no numeric raster.");
     const bounds = image.getBoundingBox(), width = image.getWidth(), height = image.getHeight();
     const west = bounds[0], south = bounds[1], east = bounds[2], north = bounds[3];
     if (west === undefined || south === undefined || east === undefined || north === undefined) throw new Error("Missing raster coordinates.");
     result = { values: Float32Array.from(raw as Float32Array, v => canonicalValue(v, s.code, s.year, s.mode === "monthly" ? s.month : undefined)), width, height, west, north, dx: (east - west) / width, dy: (north - south) / height, source: response.source, retrievedAt: response.retrievedAt, slice: s };
    }
    if (result) { if (rasterCache.size >= 12) { const oldest = rasterCache.keys().next().value; if (oldest) rasterCache.delete(oldest); } rasterCache.set(key, result); }
   }
   if (id === request.current && result) setRaster(result);
  } catch (e) { if (id === request.current) { setError(e instanceof Error ? e.message : "NASA map unavailable."); setPlay(false); } }
  finally { if (id === request.current) setBusy(false); }
 }
 useEffect(() => {
  if (!play || busy || !raster || error) return;
  const timer = setTimeout(() => { const next = { ...draft, year: draft.year >= 2025 ? param.first : draft.year + 1 }; setDraft(next); void load(next); }, 1600);
  return () => clearTimeout(timer);
 }, [play, busy, raster, error]);
 function changeYear(year: number) { const next = { ...draft, year }; setDraft(next); setPlay(false); void load(next); }
 const cell = raster && selected ? cellAt(raster, selected.lat, selected.lon) : null;
 const point: Point | null = selected ? { ...selected, label: `Selected point (${selected.lat.toFixed(4)}, ${selected.lon.toFixed(4)})`, origin: "coordinates" } : null;
 const trend = raster?.slice.mode === "trend", low = trend ? (shownParam.code === "T2M" ? -1 : -(shownParam.max / 10)) : shownParam.min, high = trend ? -low : shownParam.max;
 const unit = `${shownParam.unit}${trend ? "/decade" : ""}`;
 return <section ref={container} className="space-y-4 bg-background">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Global Spatial Map</h2><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setView(`world-${Date.now()}`)}><Globe2 />Reset to world</Button><Button size="icon" variant="outline" aria-label="Fullscreen map" title="Fullscreen map" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void container.current?.requestFullscreen(); }}><Expand /></Button></div></div>
  <details open className="border-y border-border py-3"><summary className="cursor-pointer text-sm font-medium mb-3">Map settings</summary><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <div className="space-y-1"><Label>Parameter</Label><Select value={draft.code} onValueChange={v => { setPlay(false); setDraft({ ...draft, code: v as SpatialCode, year: Math.max(draft.year, spatialParameter(v as SpatialCode).first), mode: products.includes(v as SpatialCode) ? draft.mode : "annual" }); }}><SelectTrigger aria-label="Map parameter"><SelectValue /></SelectTrigger><SelectContent>{SPATIAL_PARAMETERS.map(p => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}</SelectContent></Select></div>
   <div className="space-y-1"><Label>Display mode</Label><Select value={draft.mode} onValueChange={v => { setPlay(false); setDraft({ ...draft, mode: v as SpatialMode }); }}><SelectTrigger aria-label="Map display mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="annual">Annual value</SelectItem><SelectItem value="monthly">Monthly value</SelectItem><SelectItem value="trend" disabled={!products.includes(draft.code)}>Trend over time</SelectItem><SelectItem value="average" disabled={!products.includes(draft.code)}>Period average</SelectItem></SelectContent></Select></div>
   {draft.mode === "annual" || draft.mode === "monthly" ? <><div className="space-y-1"><Label htmlFor="map-year">Year</Label><Input id="map-year" type="number" min={param.first} max={2025} value={draft.year} onChange={e => setDraft({ ...draft, year: Number(e.target.value) })} /></div>{draft.mode === "monthly" && <div className="space-y-1"><Label htmlFor="map-month">Month</Label><Select value={String(draft.month)} onValueChange={v => setDraft({ ...draft, month: Number(v) })}><SelectTrigger id="map-month"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i} value={String(i + 1)}>{new Date(2000, i, 1).toLocaleString("en", { month: "long" })}</SelectItem>)}</SelectContent></Select></div>}</> : <div className="space-y-1"><Label>Verified common period</Label><div className="flex gap-2"><Input aria-label="Map start year" value="2005" readOnly /><Input aria-label="Map end year" value="2024" readOnly /></div></div>}
   <Button disabled={busy || draft.year < param.first || draft.year > 2025} onClick={() => { setPlay(false); void load(draft); }}>{busy ? <Loader2 className="animate-spin" /> : <Globe2 />}Update map</Button>
  </div></details>
  {!products.includes(draft.code) && <p className="text-sm text-muted-foreground">Global trend and period-average layers are not yet available for this parameter.</p>}
  <div className="flex flex-wrap items-center gap-4"><div className="flex items-center gap-2"><Label htmlFor="map-opacity">Opacity {opacity}%</Label><input id="map-opacity" type="range" min="0" max="100" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></div><Label className="flex items-center gap-2"><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} />Grid outlines (zoomed in)</Label><Select value={view.split("-")[0] ?? "world"} onValueChange={v => setView(`${v}-${Date.now()}`)}><SelectTrigger className="w-40" aria-label="Map region"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="world">World</SelectItem><SelectItem value="asia">Southeast Asia</SelectItem><SelectItem value="malaysia">Malaysia</SelectItem></SelectContent></Select></div>
  {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive"><span>{error} {raster ? "Previous map retained with its original period." : "No raster loaded."}</span><Button variant="outline" size="sm" onClick={() => void load(draft)}>Retry</Button></div>}
  <div role="status" className="text-sm font-medium">{busy ? "Loading NASA raster… " : ""}{stale ? "Settings changed — previous map shown: " : ""}{raster ? `${shownParam.label} · ${sliceLabel(raster.slice)} · ${raster.slice.mode === "trend" ? "Sen slope" : raster.slice.mode === "average" ? "20-year mean" : raster.slice.mode === "annual" ? "Annual value" : "Monthly value"}` : "Preparing world view…"}</div>
  <ClientOnly fallback={<div className="h-[420px] bg-muted" />}><Suspense fallback={<div className="h-[420px] bg-muted" />}><CanvasMap raster={raster} opacity={opacity} low={low} high={high} a={a} b={b} compare={compare} onPick={(lat, lon) => setSelected({ lat, lon })} view={view} grid={grid} /></Suspense></ClientOnly>
  <div className="space-y-2"><div className="flex justify-between text-xs"><span>{trend ? "Decreasing " : ""}{low} {unit}</span><span>{trend ? "Little change" : "Fixed numerical scale"}</span><span>{trend ? "Increasing " : ""}{high} {unit}</span></div><div className={`h-3 ${trend ? "spatial-legend-trend" : "spatial-legend-value"}`} /><p className="text-xs text-muted-foreground">Values outside these bounds use the endpoint colour. Missing cells are transparent; zero remains a value. {trend && "Temperature little change: |slope| ≤ 0.1 °C/decade. Colours do not indicate statistical significance."}</p></div>
  {(draft.mode === "annual" || draft.mode === "monthly") && <div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="Previous year" disabled={busy || draft.year <= param.first} onClick={() => changeYear(draft.year - 1)}><ChevronLeft /></Button><input aria-label="Map year slider" className="min-w-0 flex-1" type="range" min={param.first} max={2025} value={draft.year} onChange={e => changeYear(Number(e.target.value))} /><span className="text-sm">{draft.year}</span><Button size="icon" variant="outline" aria-label="Next year" disabled={busy || draft.year >= 2025} onClick={() => changeYear(draft.year + 1)}><ChevronRight /></Button><Button size="icon" variant="outline" aria-label={play ? "Pause animation" : "Play annual animation"} onClick={() => setPlay(!play)}>{play ? <Pause /> : <Play />}</Button></div>}
  {point && <div className="border-l-4 border-primary pl-4 space-y-2" aria-label="Selected spatial cell"><h3 className="text-lg font-semibold"><MapPin className="inline size-4" /> {point.lat.toFixed(4)}, {point.lon.toFixed(4)}</h3><p className="text-lg">{cell?.value === null || !cell ? "No valid data in this cell" : `${cell.value.toFixed(3)} ${unit}`} · {raster ? sliceLabel(raster.slice) : "No slice"}</p>{cell && <p className="text-xs text-muted-foreground">Cell centre: {cell.lat.toFixed(4)}, {cell.lon.toFixed(4)} · {cell.count !== null ? `${cell.count}/20 valid years` : shownParam.native}</p>}<div className="flex flex-wrap gap-2"><Button size="sm" disabled={!raster || busy || stale} onClick={() => onHistory(point, raster?.slice.code ?? draft.code)}>View historical graph</Button><Button size="sm" variant="outline" onClick={() => onUse("A", point)}>Use as location A</Button><Button size="sm" variant="outline" onClick={() => onUse("B", point)}>Use as location B</Button></div></div>}
  <details className="border-t border-border pt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Source and calculation details</summary><div className="mt-3 space-y-2"><p>NASA POWER image services · local solar time (LST). Meteorology is MERRA-2 reanalysis; solar is CERES SYN1deg, not a ground sensor.</p><p>Native resolution: {shownParam.native}. Display grid: {raster?.dy}° latitude × {raster?.dx}° longitude. Zooming does not create finer measurements. Web Mercator excludes the exact poles.</p><p>{shownParam.conversion}. Annual source means are duration-weighted; precipitation source is accumulated mm. Period average gives equal weight to each annual value.</p><p>Trend: median pairwise annual slopes × 10; requires all 20 finite annual values for 2005–2024. Annual source completeness follows NASA’s aggregation. No significance test or forecast.</p><p>Historical graphs use the monthly point API and duration-weighted annual aggregation; service quantization, native sampling and product processing may differ. Do not expect exact equality.</p><p>Retrieved: {raster?.retrievedAt ?? "Pending"}</p>{raster && <a className="underline break-all" href={`${raster.source}?f=pjson`} target="_blank" rel="noreferrer">{raster.source}</a>}{products.includes(draft.code) && <p><a href={`/spatial/${draft.code}-manifest.json`} className="underline" download>Download source and trend provenance</a></p>}</div></details>
 </section>;
}
