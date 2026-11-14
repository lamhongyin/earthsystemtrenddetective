import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe2, Loader2, Info, MapPin, GitCompareArrows, Satellite, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCATIONS, MAX_YEAR, minYearFor, PARAMETERS, validateCoords, validatePeriod } from "@/lib/trend/config";
import { fetchPowerMonthly } from "@/lib/trend/nasa.functions";
import { makePointResult, requestKey, snapshotKey, type Analysis, type Point, type Snapshot } from "@/lib/trend/comparison";
import { LocationPicker, draftPoint, numericPoint } from "@/components/LocationPicker";
import { AnalysisResults } from "@/components/AnalysisResults";
import { ForecastPanel } from "@/components/ForecastPanel";
import { AirQualityPanel } from "@/components/AirQualityPanel";
import { SpatialMapPanel } from "@/components/SpatialMapPanel";
import { HotspotPanel } from "@/components/HotspotPanel";
import { FisheriesPanel } from "@/components/FisheriesPanel";
import { PVYieldPanel } from "@/components/PVYieldPanel";
import { RainfallPanel } from "@/components/RainfallPanel";
import type { SpatialCode } from "@/lib/spatial/data";
const WorldMap = lazy(() => import("@/components/WorldMap"));

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Earth System Trend Detective — Climate and Ocean Investigations" },
    { name: "description", content: "Investigate NASA climate, POWER and imported IMERG Final monthly rainfall agreement, ocean data, spatial trends, PV estimates, forecasts and modeled air quality." },
    { property: "og:title", content: "Earth System Trend Detective — Trends and forecasts" },
    { property: "og:description", content: "Compare worldwide environmental trends and evaluate monthly forecasting models against seasonal benchmarks using real NASA POWER records." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Index,
});
function initialPoint(index: number): Point {
  const p = LOCATIONS[index] ?? LOCATIONS[0];
  return { ...p, origin: "preset" };
}
function Index() {
  const [tab, setTab] = useState("historical");
  const [mode, setMode] = useState<Snapshot["mode"]>("single");
  const [a, setA] = useState(() => draftPoint(initialPoint(0)));
  const [b, setB] = useState(() => draftPoint(initialPoint(5)));
  const [active, setActive] = useState<"A" | "B">("A");
  const [code, setCode] = useState("T2M");
  const [startYear, setStartYear] = useState("2005"), [endYear, setEndYear] = useState("2024");
  const [result, setResult] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Partial<Record<"A" | "B", string>>>({});
  const reqId = useRef(0);
  const pendingHistory = useRef(false);
  const retryUntil = useRef<Partial<Record<"A" | "B", number>>>({});
  const qc = useQueryClient(), fetchPower = useServerFn(fetchPowerMonthly);
  const param = PARAMETERS.find(p => p.code === code) ?? PARAMETERS[0];
  if (!param) throw new Error("No environmental variables configured.");
  const pointA = numericPoint(a), pointB = numericPoint(b);
  const snapshot: Snapshot = { mode, param, a: pointA, b: pointB, start: Number(startYear), end: Number(endYear) };
  const key = snapshotKey(snapshot), draftKey = useRef(key); draftKey.current = key;
  const stale = !!result && snapshotKey(result.snapshot) !== key;
  const validation = validateCoords(pointA.lat, pointA.lon) ? `Location A: ${validateCoords(pointA.lat, pointA.lon)}` : mode === "compare" && validateCoords(pointB.lat, pointB.lon) ? `Location B: ${validateCoords(pointB.lat, pointB.lon)}` : validatePeriod(snapshot.start, snapshot.end, code);
  useEffect(() => () => { reqId.current++; }, []);
  useEffect(() => { if (pendingHistory.current && !loading) { pendingHistory.current = false; void run(); } }, [key, loading, tab]);
  function useSpatialPoint(id: "A" | "B", point: Point) {
    if (loading) return;
    if (id === "A") setA(draftPoint(point)); else { setB(draftPoint(point)); setMode("compare"); }
    setActive(id);
  }
  function spatialHistory(point: Point, parameter: SpatialCode) {
    if (loading) return;
    setA(draftPoint(point)); setMode("single"); setActive("A"); setCode(parameter); setTab("historical"); pendingHistory.current = true;
  }
  function compareHotspot(point: Point) {
    if (loading) return;
    setB(draftPoint(point)); setMode("compare"); setActive("B"); setCode("T2M"); setStartYear("2005"); setEndYear("2024"); setTab("historical"); pendingHistory.current = true;
  }
  async function run(retry?: "A" | "B") {
    if (loading || validation) return;
    const s = retry && result ? result.snapshot : snapshot;
    if (retry && stale) return;
    const id = ++reqId.current, submittedKey = snapshotKey(s);
    const next: Analysis = retry && result ? { ...result, errors: { ...result.errors } } : { snapshot: s, errors: {} };
    const targets: ("A" | "B")[] = retry ? [retry] : s.mode === "compare" ? ["A", "B"] : ["A"];
    setLoading(true); setStatus(Object.fromEntries(targets.map(t => [t, "Fetching NASA data…"]))); setResult(next);
    await Promise.all(targets.map(async target => {
      const point = target === "A" ? s.a : s.b;
      try {
        const remaining = Math.ceil(((retryUntil.current[target] ?? 0) - Date.now()) / 1000);
        if (remaining > 0) throw new Error(`NASA asked us to wait. Retry location ${target} in ${remaining} seconds.`);
        const response = await qc.fetchQuery({ queryKey: requestKey(s, point), staleTime: 24 * 3600_000, gcTime: 24 * 3600_000, retry: false, queryFn: async () => {
          const r = await fetchPower({ data: { parameter: s.param.code, latitude: point.lat, longitude: point.lon, start: s.start, end: s.end } });
          if (!r.ok) { if (r.retryAfter !== undefined) retryUntil.current[target] = Date.now() + r.retryAfter * 1000; throw new Error(r.error); }
          return r;
        } });
        if (id !== reqId.current || submittedKey !== draftKey.current) return;
        setStatus(prev => ({ ...prev, [target]: "Analyzing annual observations…" }));
        const parsed = makePointResult(response.payload, point, s, response.retrievedAt);
        if (target === "A") next.a = parsed; else next.b = parsed;
        delete next.errors[target];
      } catch (e) { if (id === reqId.current && submittedKey === draftKey.current) next.errors[target] = e instanceof Error ? e.message : String(e); }
      finally { if (id === reqId.current) { setStatus(prev => ({ ...prev, [target]: undefined })); setResult({ ...next, errors: { ...next.errors } }); } }
    }));
    if (id === reqId.current) setLoading(false);
  }
  return <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6"><div className="flex items-center gap-3"><Globe2 className="size-8 shrink-0 text-primary" /><h1 className="text-2xl font-bold sm:text-4xl">Earth System Trend Detective</h1></div><p className="mt-2 text-sm text-muted-foreground">Explore worldwide environmental trends with NASA POWER</p></div></header>
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Analysis mode"><Button variant={mode === "single" ? "default" : "outline"} aria-pressed={mode === "single"} disabled={loading} onClick={() => { setMode("single"); setActive("A"); }}><MapPin />Single location</Button><Button variant={mode === "compare" ? "default" : "outline"} aria-pressed={mode === "compare"} disabled={loading} onClick={() => setMode("compare")}><GitCompareArrows />Compare two locations</Button></div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5 border-b border-border pb-6 lg:border-b-0 lg:border-r lg:pr-6"><h2 className="text-xl font-semibold">1–3. Configure analysis</h2>
          <div className="space-y-1.5"><Label htmlFor="variable">Environmental variable</Label><Select value={code} onValueChange={v => { setCode(v); if (Number(startYear) < minYearFor(v)) setStartYear(String(minYearFor(v))); }} disabled={loading}><SelectTrigger id="variable"><SelectValue /></SelectTrigger><SelectContent>{PARAMETERS.map(p => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label htmlFor="start">Start year</Label><Input id="start" type="number" min={minYearFor(code)} max={MAX_YEAR} disabled={loading} value={startYear} onChange={e => setStartYear(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="end">End year</Label><Input id="end" type="number" min={minYearFor(code)} max={MAX_YEAR} disabled={loading} value={endYear} onChange={e => setEndYear(e.target.value)} /></div></div>
          <div className="flex gap-2" role="group" aria-label="Active map target"><Button size="sm" variant={active === "A" ? "default" : "outline"} aria-pressed={active === "A"} disabled={loading} onClick={() => setActive("A")}>Select location A</Button>{mode === "compare" && <Button size="sm" variant={active === "B" ? "default" : "outline"} aria-pressed={active === "B"} disabled={loading} onClick={() => setActive("B")}>Select location B</Button>}</div>
          <LocationPicker id={active} point={active === "A" ? a : b} onChange={active === "A" ? setA : setB} disabled={loading} />
          {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}
          <Button className="h-auto min-h-10 w-full whitespace-normal py-2" disabled={!!validation || loading} onClick={() => run()}>{loading && <Loader2 className="animate-spin" />}Fetch NASA data and analyze</Button>
        </aside>
        <main className="min-w-0 space-y-6"><section hidden={tab === "spatial" || tab === "hotspots" || tab === "fisheries"} className="space-y-3"><div className="flex items-baseline justify-between gap-2"><h2 className="text-xl font-semibold">Worldwide point selection</h2><span className="text-xs text-muted-foreground">Target {active}</span></div><ClientOnly fallback={<div className="h-[340px] bg-muted" />}><Suspense fallback={<div className="h-[340px] bg-muted" />}><WorldMap a={pointA} b={pointB} compare={mode === "compare"} active={active} onSelect={(lat, lon) => { if (loading) return; const p = draftPoint({ lat, lon, label: `Selected point (${lat.toFixed(4)}, ${lon.toFixed(4)})`, origin: "coordinates" }); if (active === "A") setA(p); else setB(p); }} /></Suspense></ClientOnly>
          <div className="grid gap-3 sm:grid-cols-2">{[{ id: "A", p: pointA }, ...(mode === "compare" ? [{ id: "B", p: pointB }] : [])].map(({ id, p }) => <div key={id} className={`min-w-0 border-l-4 py-1 pl-3 ${id === "A" ? "border-primary" : "border-comparison-b"}`}><p className="break-words text-sm font-medium">{id} · {p.label}</p><p className="font-mono text-xs text-muted-foreground">{Number.isFinite(p.lat) ? p.lat.toFixed(4) : "—"}, {Number.isFinite(p.lon) ? p.lon.toFixed(4) : "—"}</p></div>)}</div></section>
          <div hidden={tab === "fisheries" || tab === "rainfall"} className="flex gap-3 border-y border-border bg-notice p-4 text-sm text-notice-foreground"><Info className="size-4 shrink-0 mt-0.5" /><p>{tab === "air" ? "Air Quality uses a NASA GEOS-CF surface grid cell, not an individual monitoring station or an entire state or country." : "This version analyzes the NASA POWER grid cell for a selected point. It does not calculate a mean over an entire state or country."}</p></div>
          {loading && <div role="status" className="space-y-1 text-sm">{Object.entries(status).map(([id, text]) => text && <p key={id} className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />Location {id}: {text}</p>)}</div>}
          <div role="tablist" aria-label="Investigation view" className="flex flex-wrap gap-2 border-b border-border pb-3"><Button role="tab" aria-selected={tab === "historical"} variant={tab === "historical" ? "default" : "outline"} onClick={() => setTab("historical")}>Historical analysis</Button><Button role="tab" aria-selected={tab === "forecast"} variant={tab === "forecast" ? "default" : "outline"} onClick={() => setTab("forecast")}>Forecast</Button><Button role="tab" aria-selected={tab === "air"} variant={tab === "air" ? "default" : "outline"} onClick={() => setTab("air")}>Air Quality</Button><Button role="tab" aria-selected={tab === "spatial"} variant={tab === "spatial" ? "default" : "outline"} onClick={() => setTab("spatial")}>Spatial Map</Button><Button role="tab" aria-selected={tab === "hotspots"} variant={tab === "hotspots" ? "default" : "outline"} onClick={() => setTab("hotspots")}>Hotspots</Button><Button role="tab" aria-selected={tab === "fisheries"} variant={tab === "fisheries" ? "default" : "outline"} onClick={() => setTab("fisheries")}>Fisheries Environment</Button><Button role="tab" aria-selected={tab === "pv"} variant={tab === "pv" ? "default" : "outline"} onClick={() => setTab("pv")}>PV Energy Yield</Button><Button role="tab" aria-selected={tab === "rainfall"} variant={tab === "rainfall" ? "default" : "outline"} onClick={() => setTab("rainfall")} className="h-auto max-w-full whitespace-normal py-2 text-left"><Satellite aria-hidden="true" className="shrink-0" /><RadioTower aria-hidden="true" className="shrink-0" /><span className="min-w-0">Rainfall and Satellite/Terrestrial Communication Propagation Rain Attenuation Estimation</span></Button></div>
          <div hidden={tab !== "rainfall"}><RainfallPanel point={pointA} /></div>
          {tab === "pv" && <PVYieldPanel a={pointA} b={pointB} compare={mode === "compare"} />}
          {tab === "fisheries" && <FisheriesPanel onUse={useSpatialPoint} />}
          {tab === "spatial" && <SpatialMapPanel a={pointA} b={pointB} compare={mode === "compare"} onUse={useSpatialPoint} onHistory={spatialHistory} onPV={point => { useSpatialPoint("A", point); setTab("pv"); }} />}
          {tab === "hotspots" && <HotspotPanel a={pointA} b={pointB} compare={mode === "compare"} onUse={useSpatialPoint} onCompare={compareHotspot} />}
          <div hidden={tab !== "historical"}>{!result && <div className="border-t border-border py-8"><h2 className="text-2xl font-semibold">Ready to investigate environmental trends</h2></div>}{result && <AnalysisResults result={result} stale={stale} loading={loading} onRetry={id => run(id)} />}</div>
          <div hidden={tab !== "forecast"}><ForecastPanel a={pointA} b={pointB} compare={mode === "compare"} code={code} /></div>
          <div hidden={tab !== "air"}><AirQualityPanel a={pointA} b={pointB} compare={mode === "compare"} /></div>
        </main>
      </div>
    </div>
  </div>;
}
