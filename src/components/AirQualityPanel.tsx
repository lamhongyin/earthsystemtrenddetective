import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Wind } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateCoords } from "@/lib/trend/config";
import type { Point } from "@/lib/trend/comparison";
import { downloadCsv, downloadJson } from "@/lib/trend/csv";
import { fetchAirQuality } from "@/lib/air-quality/service.functions";
import { alignedSeries, latestAt, peakIndex, sameGrid, selectedHours } from "@/lib/air-quality/display";
import { hourlyAirCsv, indexAirCsv } from "@/lib/air-quality/exports";
import type { AirResult, AirWindow } from "@/lib/air-quality/types";

const utc = (s: string) => `${s.replace("T", " ").replace(":00Z", "")} UTC`;
const value = (n: number | null | undefined) => n == null ? "Unavailable" : n.toFixed(2);
const indexText = (w?: AirWindow) => w?.aboveScale ? "Above 500" : w?.aqi == null ? "Insufficient hourly coverage for AQI" : String(w.aqi);
const categoryClass = (s: string | null | undefined) => s === "Good" ? "text-aqi-good" : s === "Moderate" ? "text-aqi-moderate" : s === "Unhealthy for Sensitive Groups" ? "text-aqi-sensitive" : s === "Unhealthy" ? "text-aqi-unhealthy" : s === "Very Unhealthy" ? "text-aqi-very-unhealthy" : s ? "text-aqi-hazardous" : "text-muted-foreground";

export function AirQualityPanel({ a, b, compare }: { a: Point; b: Point; compare: boolean }) {
  const fetchAir = useServerFn(fetchAirQuality);
  const [horizon, setHorizon] = useState("72"), [view, setView] = useState("hourly");
  const [submitted, setSubmitted] = useState<{ key: string; labels: string[]; results: AirResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const key = JSON.stringify([a.lat, a.lon, b.lat, b.lon, compare]);
  const current = useRef(key); current.current = key;
  const request = useRef(0);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 60_000); return () => { clearInterval(timer); request.current++; }; }, []);
  const invalid = validateCoords(a.lat, a.lon) ?? (compare ? validateCoords(b.lat, b.lon) : null);
  const stale = submitted && submitted.key !== key;
  async function run() {
    if (busy || invalid) return;
    const id = ++request.current, snapshot = key;
    const points = compare ? [a, b] : [a];
    setBusy(true); setError(null);
    try {
      const reply = await fetchAir({ data: { points: points.map(p => ({ latitude: p.lat, longitude: p.lon })), horizon: Number(horizon) as 24 | 72 | 120 } });
      if (id !== request.current || current.current !== snapshot) return;
      if (!reply.ok) { setError(reply.error); return; }
      const payload = JSON.parse(reply.resultJson) as { results: AirResult[] };
      if (payload.results.length !== points.length || payload.results.some(r => r.source !== "NASA GEOS-CF" || r.variable !== "pm25_rh35") || (payload.results.length === 2 && payload.results[0]?.snapshotId !== payload.results[1]?.snapshotId)) throw new Error("NASA results could not be aligned to one source run.");
      setSubmitted({ key: snapshot, labels: points.map(p => p.label), results: payload.results }); setNow(Date.now());
    } catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : "Air Quality retrieval failed."); }
    finally { if (id === request.current) setBusy(false); }
  }
  const results = submitted?.results ?? [];
  const chart = alignedSeries(results, view, Number(horizon), now);
  return <section className="min-w-0 space-y-5 border-t border-border pt-6">
    <div className="flex items-center gap-2"><Wind className="size-6 text-accent" /><h2 className="text-2xl font-semibold">Air Quality</h2></div>
    <div className="space-y-1"><p className="font-medium">NASA GEOS-CF model-based air-quality estimate</p><p className="text-sm font-medium">US EPA scale · PM2.5 only · estimated</p><p className="text-sm text-muted-foreground">Other pollutants can produce a higher overall AQI. This estimate is not an official monitoring-station reading or Malaysia's API/IPU.</p></div>
    <div className="flex flex-wrap items-center gap-3"><Select value={horizon} onValueChange={setHorizon} disabled={busy}><SelectTrigger className="w-full sm:w-72" aria-label="Air Quality forecast horizon"><SelectValue /></SelectTrigger><SelectContent>{[24, 72, 120].map(h => { const coverage = results[0] ? selectedHours(results[0], h, now).length : null; return <SelectItem key={h} value={String(h)}>Next {h / 24} day{h > 24 ? "s" : ""}{coverage !== null ? ` · ${coverage}/${h} h available` : ""}</SelectItem>; })}</SelectContent></Select><Button disabled={busy || !!invalid} onClick={run}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Wind className="size-4" />}Fetch air quality</Button></div>
    {invalid && <p role="alert" className="text-sm text-destructive">{invalid}</p>}
    {busy && <p role="status" className="text-sm">Retrieving NASA surface PM2.5 and checking complete 24-hour windows…</p>}
    {error && <p role="alert" className="border-l-4 border-destructive pl-3 text-sm">{error}</p>}
    {stale && <p role="alert" className="bg-notice p-3 text-sm text-notice-foreground">Locations changed. These estimates belong to the previously submitted points; fetch again.</p>}
    {results.length === 2 && results[0] && results[1] && sameGrid(results[0], results[1]) && <p className="bg-notice p-3 text-sm text-notice-foreground">Both points select the same NASA grid cell; their estimates are identical.</p>}
    {results.map((r, i) => {
      const selected = selectedHours(r, Number(horizon), now), times = new Set(selected.map(h => h.intervalEnd));
      const hourly = latestAt(r.hours.filter(h => h.pm25 !== null), h => h.intervalEnd, now);
      const supported = r.windows24h.filter(w => w.meanPm25 !== null);
      const latest = latestAt(supported, w => w.end, now), peak = peakIndex(supported.filter(w => times.has(w.end)));
      const expired = Date.parse(r.coverageEnd) <= now || now - Date.parse(r.retrievedAt) > 3600_000;
      return <section key={i} className="space-y-4 border-t border-border pt-4">
        <h3 className="break-words text-xl font-semibold">{i === 0 ? "A" : "B"} · {submitted?.labels[i]}</h3>
        {expired && <p role="alert" className="text-sm text-notice-foreground">Retained source is stale or no longer covers the present. Refresh before interpreting current conditions.</p>}
        <p className="text-xs text-muted-foreground">Requested {r.requestedPoint.latitude.toFixed(4)}, {r.requestedPoint.longitude.toFixed(4)} · NASA grid {r.gridPoint.latitude.toFixed(4)}, {r.gridPoint.longitude.toFixed(4)} · surface model layer {r.surfaceLayer}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4"><h4 className="text-sm text-muted-foreground">Latest supported hourly PM2.5</h4><p className="mt-2 text-2xl font-semibold">{value(hourly?.pm25)} <span className="text-sm">µg/m³</span></p>{hourly && <p className="mt-2 text-xs">{utc(hourly.intervalStart)} – {utc(hourly.intervalEnd)} · {Date.parse(hourly.intervalEnd) > now ? "Future forecast" : "Modeled forecast valid in the past"}</p>}</div>
          <div className="rounded-lg border border-border bg-card p-4"><h4 className="text-sm text-muted-foreground">Latest supported 24-hour PM2.5 AQI estimate</h4><p className={`mt-2 text-xl font-semibold ${categoryClass(latest?.category)}`}>{indexText(latest)}{latest?.category && ` · ${latest.category}`}</p>{latest && <p className="mt-2 text-xs">{utc(latest.start)} – {utc(latest.end)}{Date.parse(latest.end) > now ? " · Future forecast window" : ""}</p>}</div>
          <div className="rounded-lg border border-border bg-card p-4"><h4 className="text-sm text-muted-foreground">Highest supported estimate · selected forecast</h4><p className={`mt-2 text-xl font-semibold ${categoryClass(peak?.category)}`}>{indexText(peak)}{peak?.category && ` · ${peak.category}`}</p>{peak && <p className="mt-2 text-xs">{utc(peak.start)} – {utc(peak.end)}</p>}<p className="mt-2 text-xs text-muted-foreground">Index based on PM2.5 only, not the full multi-pollutant AQI.</p></div>
          <div className="rounded-lg border border-border bg-card p-4"><h4 className="text-sm text-muted-foreground">NASA forecast source coverage</h4><p className="mt-2 text-sm">{utc(r.coverageStart)} – {utc(r.coverageEnd)}</p><p className="mt-2 text-xs">Retrieved {utc(r.retrievedAt)} · initialization unavailable</p><p className="mt-2 text-sm font-medium">{selected.length}/{horizon} future hours available</p></div>
        </div>
        {selected.length < Number(horizon) && <p className="border-l-4 border-notice-foreground pl-3 text-sm">The selected period exceeds remaining source coverage. Only {selected.length} hours are shown; missing hours are not extrapolated.</p>}
        <details className="border-y border-border py-3 text-sm"><summary className="cursor-pointer font-medium">Source and calculation details · {i === 0 ? "A" : "B"}</summary><div className="mt-3 space-y-2 break-words"><p>{r.modelVersion} · {r.collection} · {r.variable}</p><p>{r.variableDefinition}. Monitor conventions and model bias may differ; the grid does not resolve a school or roadside.</p><p>{r.temporalDefinition}. UTC aggregation calendar.</p><p>{r.indexStandard}. {r.completenessPolicy}. This trailing-window estimator is not EPA NowCast.</p><p>Original units: {r.originalUnit}; conversion × {r.conversionFactor}.</p><p className="font-mono text-xs">Snapshot {r.snapshotId}</p>{r.warnings.map(w => <p key={w}>{w}</p>)}<a className="text-primary underline" href={r.documentation} target="_blank" rel="noreferrer">NASA file documentation</a></div></details>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => downloadCsv(`air_quality_${i}_hourly.csv`, hourlyAirCsv(r))}><Download className="size-4" />Hourly CSV</Button><Button size="sm" variant="outline" onClick={() => downloadCsv(`air_quality_${i}_index.csv`, indexAirCsv(r))}><Download className="size-4" />Estimated index CSV</Button><Button size="sm" variant="outline" onClick={() => downloadJson(`air_quality_${i}_reproducibility.json`, JSON.stringify(r, null, 2))}><Download className="size-4" />Reproducibility JSON</Button></div>
      </section>;
    })}
    {!!results.length && <>
      <Select value={view} onValueChange={setView}><SelectTrigger className="w-full sm:w-80" aria-label="Air Quality chart view"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hourly">Hourly PM2.5</SelectItem><SelectItem value="index">24-hour PM2.5 AQI estimate</SelectItem><SelectItem value="daily">Complete-day summary (UTC)</SelectItem></SelectContent></Select>
      <h3 className="text-lg font-semibold">{view === "hourly" ? "Hourly modeled PM2.5 (µg/m³)" : view === "daily" ? "Complete-day estimated PM2.5 AQI (UTC)" : "Estimated PM2.5 AQI — 24-hour window"}</h3>
      {chart.length ? <div className="h-[320px] min-w-0" role="img" aria-label="NASA air quality comparison chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ left: 0, right: 12, top: 10, bottom: 10 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="time" tickFormatter={s => String(s).slice(5, 16).replace("T", " ")} minTickGap={35} tick={{ fontSize: 10 }} /><YAxis width={48} domain={[0, "auto"]} tick={{ fontSize: 11 }} /><Tooltip labelFormatter={s => utc(String(s))} /><Line dataKey="A" name="Location A" stroke="var(--primary)" dot={false} connectNulls={false} isAnimationActive={false} />{results.length === 2 && <Line dataKey="B" name="Location B" stroke="var(--comparison-b)" dot={false} connectNulls={false} isAnimationActive={false} />}</LineChart></ResponsiveContainer></div> : <p className="text-sm">No supported forecast intervals within this selected period.</p>}
      <p className="text-xs text-muted-foreground">All timestamps and complete calendar days are UTC. Missing windows are unavailable; no confidence band is provided.</p>
      {results.map((r, i) => { const selected = selectedHours(r, Number(horizon), now), ends = new Set(selected.map(h => h.intervalEnd)); const windows = view === "daily" ? r.daily.filter(w => w.end > (selected[0]?.intervalStart ?? "~") && w.start < (selected.at(-1)?.intervalEnd ?? "")) : r.windows24h.filter(w => ends.has(w.end)); return <div key={i} className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><caption className="py-2 text-left font-semibold">{i === 0 ? "A" : "B"} · NASA GEOS-CF forecast · UTC</caption><thead><tr className="border-b border-border">{["Window start", "Window end", view === "hourly" ? "PM2.5 µg/m³" : "Mean PM2.5", ...(view === "hourly" ? [] : ["Valid hours", "Estimated index", "Category"])].map(t => <th key={t} className="whitespace-nowrap px-2 py-2">{t}</th>)}</tr></thead><tbody>{view === "hourly" ? selected.map(h => <tr key={h.intervalStart} className="border-b border-border"><td className="whitespace-nowrap p-2">{utc(h.intervalStart)}</td><td className="whitespace-nowrap p-2">{utc(h.intervalEnd)}</td><td className="p-2">{value(h.pm25)}</td></tr>) : windows.map(w => <tr key={w.end} className="border-b border-border"><td className="whitespace-nowrap p-2">{utc(w.start)}</td><td className="whitespace-nowrap p-2">{utc(w.end)}</td><td className="p-2">{value(w.meanPm25)}</td><td className="p-2">{w.validHours}/24</td><td className="p-2">{indexText(w)}</td><td className={`p-2 ${categoryClass(w.category)}`}>{w.category ?? "Incomplete"}</td></tr>)}</tbody></table></div>; })}
    </>}
    <div className="space-y-2 border-t border-border pt-4 text-sm"><h3 className="text-lg font-semibold">Particles, indices, and models</h3><p>PM2.5 means particles smaller than about 2.5 micrometres. An index converts concentration into categories using a specified scale.</p><p>A forecast is a model estimate; a station reading is a measurement. Wind and rain may be associated with pollution changes, but charts alone do not establish the cause.</p><p>Prediction interval not available for this forecast. Local validation not yet available.</p><p><a href="https://www.airnow.gov/aqi/aqi-basics/" target="_blank" rel="noreferrer" className="text-primary underline">EPA category guidance</a> · <a href="https://document.airnow.gov/technical-assistance-document-for-the-reporting-of-daily-air-quailty.pdf" target="_blank" rel="noreferrer" className="text-primary underline">EPA calculation standard</a> · <a href="https://eqms.doe.gov.my/apims/main" target="_blank" rel="noreferrer" className="text-primary underline">Official Malaysian monitoring</a></p></div>
  </section>;
}