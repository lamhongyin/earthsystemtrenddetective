import { lazy, Suspense, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { fetchOceanImage } from "@/lib/ocean/service.functions";
import { OCEAN_SOURCES, type OceanBounds, type OceanCode, type OceanTarget } from "@/lib/ocean/data";
import type { OceanViewport } from "@/lib/ocean/illustration";
const OceanMap = lazy(() => import("@/components/OceanMap"));
type ImageResult = Awaited<ReturnType<typeof fetchOceanImage>>;
export function FisheriesDemonstration({ month, opacity, fish, a, b, focus, view, drawing, onPick, onRectangle }: { month: string; opacity: number; fish: boolean; a: OceanTarget; b: OceanTarget | null; focus: OceanTarget; view: number; drawing: boolean; onPick: (lat: number, lon: number) => void; onRectangle: (b: OceanBounds) => void }) {
  const [layers, setLayers] = useState<Partial<Record<OceanCode, ImageResult>>>({});
  const [viewport, setViewport] = useState<OceanViewport | null>(null);
  useEffect(() => { let alive = true; setLayers({}); for (const code of ["sst", "chlorophyll"] as const) void fetchOceanImage({ data: { code, month } }).then(r => { if (alive) setLayers(v => ({ ...v, [code]: r })); }); return () => { alive = false; }; }, [month]);
  return <div className="grid min-w-0 gap-4 lg:grid-cols-2">{(["sst", "chlorophyll"] as const).map(code => { const r = layers[code]; const layer = r?.ok ? r.layer : null; const def = OCEAN_SOURCES[code]; return <div key={code} className="min-w-0 space-y-2">
    <h3 className="font-semibold">{code === "sst" ? "Sea-surface temperature" : "Chlorophyll-a"} — real data</h3>
    <div className="relative overflow-hidden border border-border"><ClientOnly fallback={<div className="h-[420px] bg-muted" />}><Suspense fallback={<div className="h-[420px] bg-muted" />}><OceanMap image={layer?.image ?? null} bounds={layer?.bounds ?? null} opacity={opacity} a={a} b={b} focus={focus} view={view} drawing={drawing} onPick={onPick} onRectangle={onRectangle} fish={fish && month === "2024-01"} viewport={viewport} onViewport={setViewport} /></Suspense></ClientOnly>{!r && <p role="status" className="absolute left-12 top-3 z-[500] bg-card px-2 py-1 text-sm">Loading real {code === "sst" ? "SST" : "chlorophyll"}…</p>}{r && !r.ok && <p role="alert" className="absolute bottom-3 left-3 right-3 z-[500] bg-card p-2 text-sm text-destructive">{r.error}</p>}</div>
    <div className="ocean-legend h-3" /><div className="flex justify-between text-xs"><span>{def.low} {def.unit}</span><span>{code === "sst" ? "16.5 °C" : "0.3 · 3 mg/m³ · log scale"}</span><span>{def.high} {def.unit}</span></div>
    <p className="text-xs text-muted-foreground">NASA Aqua MODIS · {month} · {layer?.metadata.version ?? "—"} · 1° area-weighted overview, native nominal 9 km. Transparent: land or missing. No interpolation or fish score.</p>
  </div>; })}</div>;
}