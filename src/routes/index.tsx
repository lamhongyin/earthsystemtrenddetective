import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Download, Info, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CUSTOM_LOCATION, LOCATIONS, MAX_YEAR, MIN_YEAR, PARAMETERS, validateCoords, validatePeriod, type ParameterDef } from "@/lib/trend/config";
import { annualize, parsePowerMonthly, type AnnualObservation, type MonthlyObservation } from "@/lib/trend/parse";
import { analyzeAnnual, type TrendStats } from "@/lib/trend/stats";
import { fetchPowerMonthly } from "@/lib/trend/nasa.functions";
import { annualCsv, downloadCsv, monthlyCsv, signed } from "@/lib/trend/csv";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Earth System Trend Detective — NASA POWER trend analysis" },
      { name: "description", content: "Fetch NASA POWER monthly point data and test annual environmental trends with Mann–Kendall and Theil–Sen statistics." },
      { property: "og:title", content: "Earth System Trend Detective" },
      { property: "og:description", content: "Annual trend analysis of NASA POWER monthly point data for Malaysian locations or custom coordinates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Submitted = { param: ParameterDef; location: string; lat: number; lon: number; start: number; end: number };
type Result = { meta: Submitted; monthly: MonthlyObservation[]; annual: AnnualObservation[]; stats: TrendStats };

function Index() {
  const [paramLabel, setParamLabel] = useState(PARAMETERS[0]!.label);
  const [location, setLocation] = useState<string>(LOCATIONS[0].label);
  const [customLat, setCustomLat] = useState("2.0442");
  const [customLon, setCustomLon] = useState("102.5689");
  const [startYear, setStartYear] = useState("2005");
  const [endYear, setEndYear] = useState("2024");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const reqId = useRef(0);
  const qc = useQueryClient();
  const fetchPower = useServerFn(fetchPowerMonthly);

  const preset = LOCATIONS.find((l) => l.label === location);
  const lat = preset ? preset.lat : Number(customLat.trim() === "" ? NaN : customLat);
  const lon = preset ? preset.lon : Number(customLon.trim() === "" ? NaN : customLon);
  const start = Number(startYear), end = Number(endYear);
  const validation = validateCoords(lat, lon) ?? validatePeriod(start, end);

  async function run() {
    if (validation || loading) return;
    const meta: Submitted = { param: PARAMETERS.find((p) => p.label === paramLabel)!, location, lat, lon, start, end };
    const id = ++reqId.current;
    setLoading(true); setError(null);
    try {
      const key = ["power", meta.param.code, lat, lon, start, end];
      const payloadText = await qc.fetchQuery({
        queryKey: key, staleTime: 24 * 3600_000, gcTime: 24 * 3600_000, retry: false,
        queryFn: async () => {
          const r = await fetchPower({ data: { parameter: meta.param.code, latitude: lat, longitude: lon, start, end } });
          if (!r.ok) throw new Error(r.error);
          return r.payload;
        },
      });
      const payload = JSON.parse(payloadText);
      const monthly = parsePowerMonthly(payload, meta.param.code, start, end);
      const annual = annualize(monthly, meta.param.aggregation);
      const stats = analyzeAnnual(annual.map((a) => a.year), annual.map((a) => a.value));
      if (id === reqId.current) setResult({ meta, monthly, annual, stats });
    } catch (e) {
      if (id === reqId.current) { setResult(null); setError((e as Error)?.message || String(e)); }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">🌍 Earth System Trend Detective</h1>
            <p className="mt-1 text-sm text-muted-foreground">NASA POWER monthly point data · Annual trend analysis · Prototype</p>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_1fr]">
          <aside className="h-fit rounded-xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold">1–3. Configure analysis</h2>
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); run(); }}>
              <div className="space-y-1.5">
                <Label htmlFor="variable">Environmental variable</Label>
                <Select value={paramLabel} onValueChange={setParamLabel}>
                  <SelectTrigger id="variable"><SelectValue /></SelectTrigger>
                  <SelectContent>{PARAMETERS.map((p) => <SelectItem key={p.code} value={p.label}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger id="location"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((l) => <SelectItem key={l.label} value={l.label}>{l.label}</SelectItem>)}
                    <SelectItem value={CUSTOM_LOCATION}>{CUSTOM_LOCATION}</SelectItem>
                  </SelectContent>
                </Select>
                {!preset && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1"><Label htmlFor="lat" className="text-xs">Latitude</Label>
                      <Input id="lat" inputMode="decimal" value={customLat} onChange={(e) => setCustomLat(e.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor="lon" className="text-xs">Longitude</Label>
                      <Input id="lon" inputMode="decimal" value={customLon} onChange={(e) => setCustomLon(e.target.value)} /></div>
                  </div>
                )}
                {Number.isFinite(lat) && Number.isFinite(lon) && (
                  <p className="font-mono text-xs text-muted-foreground">{lat.toFixed(4)}, {lon.toFixed(4)}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label htmlFor="start">Start year</Label>
                  <Input id="start" type="number" min={MIN_YEAR} max={MAX_YEAR} step={1} value={startYear} onChange={(e) => setStartYear(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="end">End year</Label>
                  <Input id="end" type="number" min={MIN_YEAR} max={MAX_YEAR} step={1} value={endYear} onChange={(e) => setEndYear(e.target.value)} /></div>
              </div>
              {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}
              <Button type="submit" className="w-full" disabled={!!validation || loading}>
                {loading && <Loader2 className="animate-spin" />}Fetch NASA data and analyze
              </Button>
            </form>
          </aside>

          <main className="min-w-0 space-y-6">
            <div className="flex gap-3 rounded-xl border border-border bg-notice p-4 text-sm text-notice-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>This version analyzes the NASA POWER grid cell for a selected point. It does not calculate a mean over an entire state or country.</p>
            </div>

            {loading && (
              <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 shadow-card">
                <Loader2 className="size-5 animate-spin text-accent" />Fetching and processing monthly NASA POWER data…
              </div>
            )}

            {error && !loading && (
              <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-5 shadow-card">
                <p className="font-semibold text-destructive">Unable to complete the analysis:</p>
                <p className="mt-1 text-sm">{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={run} disabled={!!validation}>Retry</Button>
              </div>
            )}

            {!result && !loading && !error && (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-card">
                <h2 className="text-2xl font-semibold">Ready to investigate environmental trends</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Choose a variable, a point and a period of at least eight years, then click <strong>Fetch NASA data and analyze</strong>.</p>
              </div>
            )}

            {result && <Results r={result} />}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-5 shadow-card"><h2 className="mb-4 text-xl font-semibold">{title}</h2>{children}</section>;
}

function Results({ r }: { r: Result }) {
  const { meta, annual, monthly, stats } = r;
  const unit = meta.param.annualUnit;
  const data = annual.map((a, i) => ({ year: a.year, value: a.value, fit: stats.predicted[i]! }));
  const hasGaps = annual.some((a, i) => i > 0 && a.year - annual[i - 1]!.year > 1);
  const slopeUnit = `${unit}/year`;
  const slopeHint = meta.param.code === "RH2M" ? "Percentage points of relative humidity per year." : meta.param.code === "PRECTOTCORR" ? "Change in annual rainfall total (mm) per calendar year." : `Change in annual value per calendar year.`;

  return (
    <>
      <Card title="4. Environmental time series">
        <dl className="mb-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <Meta k="Variable" v={`${meta.param.description} (${meta.param.code})`} />
          <Meta k="Location" v={`${meta.location} · ${meta.lat.toFixed(4)}, ${meta.lon.toFixed(4)}`} />
          <Meta k="Complete years" v={`${annual[0]!.year}–${annual[annual.length - 1]!.year} (${annual.length} years)`} />
          <Meta k="Valid monthly observations" v={String(monthly.length)} />
          <Meta k="Spatial basis" v="Grid-cell estimate" />
        </dl>
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} allowDecimals={false} tick={{ fontSize: 12 }} label={{ value: "Year", position: "insideBottom", offset: -4, fontSize: 12 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} width={70} tickFormatter={(v) => Number(v).toFixed(1)} label={{ value: `${meta.param.label} (${unit})`, angle: -90, position: "insideLeft", fontSize: 12, style: { textAnchor: "middle" } }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(3)} ${unit}`} labelFormatter={(l) => `Year ${l}`} />
              <Legend verticalAlign="top" align="left" height={30} />
              <Line name="Annual observation" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              <Line name="Linear regression (dashed)" dataKey="fit" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="5. Trend significance">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat k="Trend direction" v={stats.direction} />
          <Stat k="Linear slope" v={`${signed(stats.linearSlope)} ${slopeUnit}`} hint={slopeHint} />
          <Stat k="Mann–Kendall p-value" v={stats.pValue.toFixed(4)} hint={`Unrounded: ${stats.pValue}`} />
          <Stat k="Significant at α = 0.05?" v={stats.significant ? "Yes" : "No"} />
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <Meta k="Sen's slope" v={`${signed(stats.senSlope)} ${slopeUnit}`} />
          <Meta k="Sen 95% CI" v={`${signed(stats.senCiLow)} to ${signed(stats.senCiHigh)} ${slopeUnit}`} />
          <Meta k="R²" v={stats.rSquared.toFixed(3)} />
        </dl>
        <p className="mt-4 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
          {stats.significant
            ? `The annual series provides evidence of a ${stats.direction} monotonic trend (p < 0.05).`
            : "The annual series does not provide sufficient statistical evidence of a monotonic trend at the 5% level."}
        </p>
        {stats.autocorr !== null && Math.abs(stats.autocorr) > 0.3 && (
          <p className="mt-3 flex gap-2 rounded-lg bg-notice p-3 text-sm text-notice-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Substantial lag-one correlation was detected in the detrended annual series. Mann–Kendall p-values assume independent observations and may require a modified test.
          </p>
        )}
        {hasGaps && stats.autocorr !== null && (
          <p className="mt-3 text-xs text-muted-foreground">Some years were excluded, so lag-one correlation compares successive retained observations that may not be one calendar year apart.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Annual aggregation reduces the seasonal cycle. Trend tests do not identify causes of change; verify data quality, temporal dependence, and coverage before scientific conclusions.</p>
      </Card>

      <Card title="Downloads and annual data">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadCsv(`nasa_power_${meta.param.code}_annual.csv`, annualCsv(meta.param.code, unit, annual))}><Download />Download annual observations (CSV)</Button>
          <Button variant="outline" onClick={() => downloadCsv(`nasa_power_${meta.param.code}_monthly.csv`, monthlyCsv(monthly))}><Download />Download monthly observations (CSV)</Button>
        </div>
        <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left"><tr><th className="px-3 py-2 font-medium">year</th><th className="px-3 py-2 font-medium">{meta.param.code}_{unit}</th></tr></thead>
            <tbody className="font-mono">
              {annual.map((a) => <tr key={a.year} className="border-t border-border"><td className="px-3 py-1.5">{a.year}</td><td className="px-3 py-1.5">{a.value}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Source: NASA Langley Research Center POWER Project, monthly point data (values may include reanalysis/model inputs).{" "}
          <a className="inline-flex items-center gap-1 text-primary underline" href="https://power.larc.nasa.gov/docs/services/api/temporal/monthly/" target="_blank" rel="noreferrer">NASA POWER Monthly API<ExternalLink className="size-3" /></a>
        </p>
      </Card>
    </>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
function Stat({ k, v, hint }: { k: string; v: string; hint?: string }) {
  const body = <div className="h-full rounded-lg border border-border bg-background p-4 text-left"><p className="flex items-center gap-1 text-xs text-muted-foreground">{k}{hint && <Info className="size-3" aria-hidden />}</p><p className="mt-1 font-display text-2xl font-semibold">{v}</p></div>;
  if (!hint) return body;
  return <UiTooltip><TooltipTrigger asChild><button type="button" className="h-full rounded-lg focus-visible:outline-2 focus-visible:outline-ring">{body}</button></TooltipTrigger><TooltipContent>{hint}</TooltipContent></UiTooltip>;
}
