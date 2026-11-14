import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { empiricalCcdf, ccdfCsv, strictExceedance } from "@/lib/rainfall/ccdf";
import type { RainSeries } from "@/lib/rainfall/data";
import { downloadCsv } from "@/lib/trend/csv";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function MonthlyRainfallCcdf({ series, period, pairedMonths }: { series: RainSeries[]; period: string; pairedMonths?: string[] }) {
  const [month, setMonth] = useState("0"), [log, setLog] = useState(false), [threshold, setThreshold] = useState("");
  const selected = useMemo(() => series.map(s => ({ ...s, rows: s.rows.filter(r => !pairedMonths || pairedMonths.includes(r.month)) })), [series, pairedMonths]);
  const curves = selected.map(s => ({ source: s, ...empiricalCcdf(s.rows, Number(month)) }));
  // Common union of thresholds keeps both strict survival steps aligned without interpolation.
  const thresholds = [...new Set(curves.flatMap(c => c.points.map(p => p.thresholdMm)))].sort((a, b) => a - b);
  const data = thresholds.map(thresholdMm => Object.fromEntries([["thresholdMm", thresholdMm], ...curves.map(c => {
    const p = strictExceedance(c.values, thresholdMm);
    return [c.source.sourceId, log && (p.percent === null || p.percent <= 0) ? null : p.percent];
  })]));
  return <section className="min-w-0 space-y-3" aria-label="Monthly rainfall statistics">
    <h3 className="text-lg font-semibold">Monthly rainfall totals — empirical CCDF</h3>
    <div className="flex flex-wrap items-end gap-3"><div className="w-40"><Label>Calendar-month filter</Label><Select value={month} onValueChange={setMonth}><SelectTrigger aria-label="CCDF calendar month"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">All months</SelectItem>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i} value={String(i + 1)}>{new Date(Date.UTC(2000, i)).toLocaleString("en", { month: "long", timeZone: "UTC" })}</SelectItem>)}</SelectContent></Select></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={log} onChange={e => setLog(e.target.checked)} />Logarithmic Y axis</label></div>
    {curves.map(c => <p key={c.source.sourceId} className="break-words text-xs text-muted-foreground">{c.source.sourceId} · {period} · N={c.validCount} · {c.excludedCount} missing/invalid excluded{pairedMonths ? ` · common valid paired months (${pairedMonths.length} before filter)` : ""} · {c.source.support.mode} {JSON.stringify(c.source.support.bounds)} · {c.validCount ? `${(100 / c.validCount).toFixed(4)}% per observation` : "No valid monthly sample"}</p>)}
    {curves.some(c => c.validCount) ? <div className="h-[270px] min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 5, right: 15, left: 12, bottom: 30 }}><CartesianGrid stroke="var(--border)" /><XAxis type="number" dataKey="thresholdMm" domain={[0, "dataMax"]} tickFormatter={v => Number(v).toFixed(0)} tick={{ fontSize: 10 }} label={{ value: "Monthly rainfall total (mm)", position: "insideBottom", offset: -20, fontSize: 10 }} /><YAxis scale={log ? "log" : "linear"} domain={log ? ["auto", 100] : [0, 100]} allowDataOverflow tick={{ fontSize: 10 }} label={{ value: "Valid months exceeding this total (%)", angle: -90, position: "insideLeft", fontSize: 10 }} /><Tooltip content={({ active, label }) => active ? <div className="max-w-64 border border-border bg-popover p-3 text-xs text-popover-foreground"><strong>{Number(label).toFixed(2)} mm</strong>{curves.map(c => { const p = strictExceedance(c.values, Number(label)); return <p key={c.source.sourceId}>{c.source.sourceId}: {p.count}/{p.validCount} above · {p.percent?.toFixed(4) ?? "—"}% · {period} · {c.source.support.mode} {JSON.stringify(c.source.support.bounds)}</p>; })}</div> : null} /><Legend verticalAlign="top" />{curves.map((c, i) => <Line type="stepAfter" key={c.source.sourceId} name={c.source.sourceId} dataKey={c.source.sourceId} stroke={i === 0 ? "var(--primary)" : "var(--comparison-b)"} dot={curves.every(c => c.validCount <= 1)} connectNulls={false} strokeWidth={2} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div> : <p role="status">No valid monthly observations for this filter.</p>}
    {log && <p className="text-xs text-muted-foreground">True zero exceedances remain in exports; zero is omitted only from the logarithmic display. No epsilon probability is invented.</p>}
    <div className="flex flex-wrap items-end gap-2"><div className="w-44"><Label htmlFor="ccdf-threshold">Threshold (mm)</Label><Input id="ccdf-threshold" type="number" value={threshold} onChange={e => setThreshold(e.target.value)} /></div><Button variant="outline" onClick={() => downloadCsv("rainfall-monthly-ccdf.csv", ccdfCsv(selected, Number(month), period))}><Download />CCDF CSV</Button></div>
    {threshold.trim() && Number.isFinite(Number(threshold)) && curves.map(c => { const p = strictExceedance(c.values, Number(threshold)); return <p className="text-sm" key={c.source.sourceId}>{c.source.sourceId}: {p.count}/{p.validCount} months strictly above {Number(threshold)} mm · {p.percent?.toFixed(4) ?? "No sample"}%</p>; })}
    <p className="text-xs text-muted-foreground">Strict empirical monthly exceedance, not annual one-minute time exceedance. Propagation rain-rate CCDF requires one-minute integration statistics in mm/h. IMERG half-hourly means support a separate 30-minute distribution and locally validated conversion research, not direct recovery of minute extremes. This monthly sample does not determine R0.01 or link availability.</p>
  </section>;
}