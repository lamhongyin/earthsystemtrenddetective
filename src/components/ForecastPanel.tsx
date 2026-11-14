import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ForecastResults } from "./ForecastResults";
import { PARAMETERS, validateCoords, SOLAR_CODE, minYearFor, communityFor, CANONICAL_UNIT_VERSION } from "@/lib/trend/config";
import type { Point } from "@/lib/trend/comparison";
import { parseSolarMonthly } from "@/lib/trend/solar";
import { parsePowerMonthly } from "@/lib/trend/parse";
import { fetchPowerMonthly } from "@/lib/trend/nasa.functions";
import { forecastService } from "@/lib/forecast/service.functions";
import type { ForecastRequest, ForecastResult, ForecastModel, ForecastJob } from "@/lib/forecast/types";
type PanelResult = { key: string; label: string; exportLabel: string; result?: ForecastResult; error?: string };
export function ForecastPanel({ a, b, compare, code }: { a: Point; b: Point; compare: boolean; code: string }) {
  const [target, setTarget] = useState("A"), [variable, setVariable] = useState(code);
  const [start, setStart] = useState("2000-01"), [end, setEnd] = useState("2024-12");
  const [horizon, setHorizon] = useState("12"), [level, setLevel] = useState("0.95"), [model, setModel] = useState<ForecastModel>("auto");
  const [loading, setLoading] = useState(false), [progress, setProgress] = useState(""), [error, setError] = useState("");
  const [results, setResults] = useState<PanelResult[]>([]), [submitted, setSubmitted] = useState("");
  const runId = useRef(0), jobId = useRef<string | null>(null), mounted = useRef(true);
  const power = useServerFn(fetchPowerMonthly), serviceFn = useServerFn(forecastService), qc = useQueryClient();
  async function service(input: Parameters<typeof serviceFn>[0]): Promise<{ ok: true; job: ForecastJob } | { ok: false; error: string }> {
    const response = await serviceFn(input);
    return response.ok ? { ok: true, job: JSON.parse(response.jobJson) as ForecastJob } : response;
  }
  const key = JSON.stringify({ a, b: compare ? b : null, target, variable, start, end, horizon, level, model });
  const draftKey = useRef(key); draftKey.current = key;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; runId.current++; }; }, []);
  const targetIds = compare && target === "both" ? ["A", "B"] : [compare ? target : "A"];
  const minYear = variable === "all" ? 1984 : minYearFor(variable);
  const validation = !/^\d{4}-(0[1-9]|1[0-2])$/.test(start) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(end) || start > end || Number(start.slice(0, 4)) < minYear || Number(end.slice(0, 4)) > 2025 ? `Choose an ordered monthly training period between ${minYear} and 2025.` : !Number.isInteger(Number(horizon)) || Number(horizon) < 1 || Number(horizon) > 24 ? "Forecast horizon must be a whole number from 1 to 24 months." : targetIds.map(id => validateCoords((id === "B" ? b : a).lat, (id === "B" ? b : a).lon)).find(Boolean);
  useEffect(() => { if (!loading) setVariable(code); }, [code]);
  useEffect(() => { if (start < `${minYear}-01`) setStart(`${minYear}-01`); }, [minYear]);
  async function cancel() {
    runId.current++; setLoading(false); setProgress("Forecast stopped; existing results are preserved.");
    const id = jobId.current; jobId.current = null;
    if (id) await service({ data: { action: "cancel", id } }).catch(() => undefined);
  }
  async function run() {
    if (loading || validation) return;
    const id = ++runId.current, current = key;
    const live = () => mounted.current && id === runId.current && current === draftKey.current;
    setLoading(true); setError(""); setProgress("Checking training service…");
    try {
      const ready = await service({ data: { action: "check" } });
      if (!ready.ok) throw new Error(ready.error);
      if (!live()) return;
      const params = variable === "all" ? PARAMETERS : PARAMETERS.filter(p => p.code === variable);
      const requests: { request: ForecastRequest; label: string; exportLabel: string; key: string }[] = [];
      for (const p of params) {
        const pending = [];
        for (const location of targetIds) {
          const point = location === "B" ? b : a;
          setProgress(`Fetching monthly NASA data · ${location} · ${p.code}`);
          const response = await qc.fetchQuery({ queryKey: ["forecast-nasa", p.code, point.lat, point.lon, start.slice(0, 4), end.slice(0, 4), communityFor(p.code), "monthly", CANONICAL_UNIT_VERSION], staleTime: 24 * 3600_000, retry: false, queryFn: async () => {
            const r = await power({ data: { parameter: p.code, latitude: point.lat, longitude: point.lon, start: Number(start.slice(0, 4)), end: Number(end.slice(0, 4)) } });
            if (!r.ok) throw new Error(r.error); return r;
          } });
          if (!live()) return;
          const payload = JSON.parse(response.payload) as { header?: unknown; geometry?: unknown; parameters?: unknown };
          const today = new Date(), lastComplete = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
          const solar = p.code === SOLAR_CODE ? parseSolarMonthly(payload) : undefined;
          const observations = (solar?.monthly ?? parsePowerMonthly(payload, p.code)).map(r => ({ month: r.date.slice(0, 7), value: r.value })).filter(r => r.month >= start && r.month <= end && r.month < lastComplete);
          if (!observations.length) throw new Error(`No eligible complete monthly data for ${location} · ${p.code}.`);
          const exportLabel = point.origin === "search" ? `Selected point (${point.lat}, ${point.lon})` : point.label;
          pending.push({ request: { parameter: p.code, latitude: point.lat, longitude: point.lon, start, end, horizon: Number(horizon), level: Number(level) as ForecastRequest["level"], model, observations, provenance: { source: "NASA POWER monthly point", retrievedAt: response.retrievedAt, header: payload.header ?? null, geometry: payload.geometry ?? null, parameters: payload.parameters ?? null, sourceUnit: solar?.metadata.originalUnit ?? p.unit, community: communityFor(p.code), temporalResolution: "monthly", canonicalUnitVersion: CANONICAL_UNIT_VERSION, solar: solar?.metadata ?? null, normalizedUnit: p.unit, location: exportLabel } }, label: `${location} · ${point.label}`, exportLabel, key: `${location}_${p.code}` });
        }
        if (pending.length === 2 && pending[0]?.request.observations.at(-1)?.month !== pending[1]?.request.observations.at(-1)?.month) throw new Error(`A/B ${p.code} comparison blocked: latest valid observations differ. Revise the training end to a common complete cutoff.`);
        requests.push(...pending);
      }
      if (!live()) return;
      setSubmitted(current); setResults([]);
      const next: PanelResult[] = [];
      for (let index = 0; index < requests.length; index++) {
        const task = requests[index]; if (!task || !live()) return;
        try {
          setProgress(`Training ${index + 1}/${requests.length} · ${task.label} · ${task.request.parameter}`);
          const response = await service({ data: { action: "submit", request: task.request } });
          if (!response.ok) throw new Error(response.error);
          jobId.current = response.job.id;
          if (!live()) { await service({ data: { action: "cancel", id: response.job.id } }); return; }
          let job = response.job;
          while (job.status === "queued" || job.status === "running") {
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (!live()) { await service({ data: { action: "cancel", id: response.job.id } }); return; }
            const poll = await service({ data: { action: "poll", id: response.job.id } });
            if (!poll.ok) throw new Error(poll.error);
            job = poll.job;
            setProgress(`${index + 1}/${requests.length} · ${task.label} · ${task.request.parameter} · ${job.stage ?? job.status}`);
          }
          if (!live()) return;
          if (job.status !== "completed" || !job.result) throw new Error(job.error ?? "Forecast did not complete.");
          next.push({ key: task.key, label: task.label, exportLabel: task.exportLabel, result: job.result });
        } catch (e) { if (!live()) return; next.push({ key: task.key, label: task.label, exportLabel: task.exportLabel, error: e instanceof Error ? e.message : "Forecast failed." }); }
        finally { jobId.current = null; }
        if (live()) setResults([...next]);
      }
      if (live()) setProgress("Forecast evaluation complete.");
    } catch (e) { if (live()) { setError(e instanceof Error ? e.message : "Forecast failed."); setProgress(""); } }
    finally { if (mounted.current && id === runId.current) setLoading(false); }
  }
  const select = (label: string, value: string, change: (v: string) => void, options: [string, string][]) => <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={change} disabled={loading}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([v, text]) => <SelectItem key={v} value={v}>{text}</SelectItem>)}</SelectContent></Select></div>;
  return <div className="space-y-6 border-t border-border pt-5"><div><h2 className="text-2xl font-semibold">Monthly forecasting</h2><p className="mt-1 text-sm text-muted-foreground">Experimental statistical forecast based on historical NASA POWER data</p></div>
    <div className="grid gap-4 sm:grid-cols-2">{select("Forecast locations", compare ? target : "A", setTarget, compare ? [["A", "Location A"], ["B", "Location B"], ["both", "Both locations"]] : [["A", "Location A"]])}{select("Forecast parameter", variable, setVariable, [...PARAMETERS.map(p => [p.code, p.label] as [string, string]), ["all", "All five parameters"]])}
      <div className="space-y-1.5"><Label htmlFor="forecast-start">Training starts</Label><Input id="forecast-start" type="month" min={`${minYear}-01`} max="2025-12" value={start} disabled={loading} onChange={e => setStart(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="forecast-end">Training ends</Label><Input id="forecast-end" type="month" min="1981-01" max="2025-12" value={end} disabled={loading} onChange={e => setEnd(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="forecast-horizon">Forecast horizon (months)</Label><Input id="forecast-horizon" type="number" min={1} max={24} value={horizon} disabled={loading} onChange={e => setHorizon(e.target.value)} /><div className="flex gap-2 pt-1">{[3, 6, 12, 24].map(h => <Button key={h} size="sm" variant={horizon === String(h) ? "default" : "outline"} disabled={loading} onClick={() => setHorizon(String(h))}>{h}</Button>)}</div></div>
      {select("Prediction interval level", level, setLevel, [["0.8", "80%"], ["0.9", "90%"], ["0.95", "95%"]])}{select("Forecast model", model, v => setModel(v as ForecastModel), [["auto", "Auto-select by validation MAE"], ["seasonal_naive", "Seasonal naive benchmark (not ML)"], ["gradient_boosted", "Gradient-boosted trees"]])}
    </div>{validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={!!validation || loading} onClick={run}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Train, evaluate and forecast</Button>{loading && <Button variant="outline" onClick={cancel}><Square className="size-4" />Stop</Button>}</div>
    {progress && <p role="status" className="text-sm text-muted-foreground">{progress}</p>}{error && <p role="alert" className="border-l-4 border-destructive pl-3 text-sm text-destructive">{error}</p>}
    {results.length > 0 && submitted !== key && <p className="bg-notice p-3 text-sm text-notice-foreground">Settings changed. These results retain the submitted training period and locations.</p>}
    {results.map(r => r.result ? <ForecastResults key={r.key} result={r.result} label={r.label} exportLabel={r.exportLabel} /> : <div key={r.key} role="alert" className="border-l-4 border-destructive pl-3 text-sm"><strong>{r.label}</strong><p>{r.error}</p></div>)}
  </div>;
}
