import { useState } from "react";
import { Upload, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { importGiovanni, inspectCsv, MAX_CSV_BYTES, type CsvInspection, type ImportReview } from "@/lib/rainfall/import";
import type { RainSeries, RainUnit } from "@/lib/rainfall/data";

export function RainfallImport({ onImport }: { onImport: (series: RainSeries) => void }) {
  const [csv, setCsv] = useState<CsvInspection | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ImportReview>({ sourceId: "IMERG", datasetId: "GPM_3IMERGM_07", version: "07", variable: "GPM_3IMERGM_07_precipitation", dateColumn: "", valueColumn: "", unit: "mm/hour", intervalConfirmed: false, timeConvention: "", citation: "", sourceLink: "", fillValues: "", support: { mode: "region", bounds: { west: 102, south: 1, east: 104, north: 3 }, mask: "", resolution: "0.1°", aggregation: "", spatialCoverage: "" } });
  const [unitConfirmed, setUnitConfirmed] = useState(false);
  function select(label: string, value: string, options: string[], change: (v: string) => void) { return <div className="space-y-1"><Label>{label}</Label><Select value={value} onValueChange={change}><SelectTrigger aria-label={label}><SelectValue placeholder="Choose from file" /></SelectTrigger><SelectContent>{options.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>; }
  function field(label: string, key: "timeConvention" | "citation" | "sourceLink" | "fillValues" | "version", placeholder: string) { return <div className="space-y-1"><Label htmlFor={`rain-${key}`}>{label}</Label><Input id={`rain-${key}`} value={review[key]} placeholder={placeholder} onChange={e => setReview({ ...review, [key]: e.target.value })} /></div>; }
  return <section className="space-y-4 border-t border-border pt-5"><h3 className="text-lg font-semibold">Import Giovanni CSV</h3><div className="flex flex-wrap items-center gap-3"><Upload className="size-4" /><Input aria-label="Scientific rainfall CSV" type="file" accept=".csv,text/csv" className="max-w-sm" onChange={async e => {
    setError(""); setCsv(null); setUnitConfirmed(false);
    const file = e.target.files?.[0]; if (!file) return;
    try {
      if (!/\.csv$/i.test(file.name) || file.size > MAX_CSV_BYTES) throw new Error("Upload a CSV file no larger than 2 MB.");
      const parsed = inspectCsv(await file.text()); setCsv(parsed);
      setReview(r => ({ ...r, dateColumn: parsed.suggestedDate, valueColumn: parsed.suggestedValue, intervalConfirmed: false }));
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed."); }
  }} /></div>
  {csv && <div className="space-y-4"><details open><summary className="font-medium">Original file metadata</summary><dl className="mt-2 space-y-1 text-xs">{Object.entries(csv.metadata).map(([k, v]) => <div key={k} className="break-words"><dt className="font-semibold">{k}</dt><dd>{v}</dd></div>)}</dl></details><p className="text-sm">{csv.table.length} table rows · review original units, dataset and spatial meaning before accepting.</p>
    <div className="grid gap-3 sm:grid-cols-2">{select("Imported source", review.sourceId, ["IMERG", "POWER"], source => setReview(r => ({ ...r, sourceId: source as "IMERG" | "POWER", datasetId: source === "IMERG" ? "GPM_3IMERGM_07" : "POWER PRECTOTCORR", variable: source === "IMERG" ? "GPM_3IMERGM_07_precipitation" : "PRECTOTCORR" })))}
      {select("Date column", review.dateColumn, csv.headers, dateColumn => setReview({ ...review, dateColumn }))}{select("Rainfall value column", review.valueColumn, csv.headers, valueColumn => setReview({ ...review, valueColumn }))}{select("Original value unit", review.unit, ["mm/hour", "mm/day", "kg/m2/s", "mm"], unit => { setReview({ ...review, unit: unit as RainUnit }); setUnitConfirmed(false); })}
      {field("Version", "version", "07 or 07B for IMERG")}{field("Time convention", "timeConvention", "e.g. UTC, as documented")}{field("Source citation / export identity", "citation", "Original dataset and Giovanni export/session identity")}{field("Public NASA provenance link", "sourceLink", "https://giovanni.gsfc.nasa.gov/…")}{field("Additional fill markers", "fillValues", "Comma-separated original fill values")}
      {select("Spatial meaning", review.support.mode, ["point", "region"], mode => setReview({ ...review, support: { ...review.support, mode: mode as "point" | "region" } }))}
      {(["west", "south", "east", "north"] as const).map(k => <div key={k}><Label htmlFor={`rain-${k}`}>Actual {k} bound (°)</Label><Input id={`rain-${k}`} type="number" step="any" value={review.support.bounds[k]} onChange={e => setReview({ ...review, support: { ...review.support, bounds: { ...review.support.bounds, [k]: Number(e.target.value) } } })} /></div>)}
      {(["mask", "resolution", "aggregation", "spatialCoverage"] as const).map(k => <div key={k}><Label htmlFor={`rain-support-${k}`}>{({ mask: "Mask (land/all-cell)", resolution: "Source grid resolution", aggregation: "Aggregation / boundary-cell rule", spatialCoverage: "Spatial coverage / valid cells" })[k]}</Label><Input id={`rain-support-${k}`} value={review.support[k]} onChange={e => setReview({ ...review, support: { ...review.support, [k]: e.target.value } })} /></div>)}
    </div><p className="text-sm font-medium">{review.datasetId} · {review.variable} · {review.sourceId === "IMERG" ? "Final Run" : "Actual POWER export required; Giovanni MERRA-2 is not POWER"}</p>
    <div className="flex items-start gap-2"><Checkbox id="rain-unit-confirm" checked={unitConfirmed} onCheckedChange={v => setUnitConfirmed(v === true)} /><Label htmlFor="rain-unit-confirm">These are the original downloaded units, not assumed display units.</Label></div><div className="flex items-start gap-2"><Checkbox id="rain-month-confirm" checked={review.intervalConfirmed} onCheckedChange={v => setReview({ ...review, intervalConfirmed: v === true })} /><Label htmlFor="rain-month-confirm">Every row represents an exact complete calendar month; bounds and source metadata match this file.</Label></div>
    <Button disabled={!unitConfirmed || !review.intervalConfirmed || busy} onClick={async () => { setBusy(true); setError(""); try { const result = await importGiovanni(csv, review); onImport(result); setCsv(null); } catch (e) { setError(e instanceof Error ? e.message : "Import failed."); } finally { setBusy(false); } }}><Check />{busy ? "Validating…" : "Validate and accept import"}</Button></div>}
  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}</section>;
}