import { useState } from "react";
import { Satellite, RadioTower, Download } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { REVISIONS, validateScenario, MODEL_VERSION, type Scenario } from "@/lib/attenuation/model";
import { downloadJson } from "@/lib/trend/csv";

export function RainAttenuationPanel() {
  const [mode, setMode] = useState<Scenario["mode"]>("satellite");
  const [frequency, setFrequency] = useState("20"), [p, setP] = useState("0.01"), [elevation, setElevation] = useState("30"), [altitude, setAltitude] = useState("0"), [distance, setDistance] = useState("10"), [h1, setH1] = useState("30"), [h2, setH2] = useState("30");
  const [polarization, setPolarization] = useState<Scenario["polarization"]>("horizontal"), [submitted, setSubmitted] = useState<Scenario | null>(null);
  const s: Scenario = { mode, frequencyGHz: frequency.trim() ? Number(frequency) : NaN, pPercent: p.trim() ? Number(p) : NaN, polarization, elevationDeg: elevation.trim() ? Number(elevation) : NaN, altitudeKmAsl: altitude.trim() ? Number(altitude) / 1000 : NaN, distanceKm: distance.trim() ? Number(distance) : NaN, antenna1KmAsl: h1.trim() ? Number(h1) / 1000 : NaN, antenna2KmAsl: h2.trim() ? Number(h2) / 1000 : NaN };
  const errors = validateScenario(s);
  const field = (id: string, label: string, value: string, change: (v: string) => void, key: keyof Scenario) => <div><Label htmlFor={id}>{label}</Label><Input id={id} type="number" value={value} onChange={e => change(e.target.value)} aria-invalid={!!errors[key]} />{errors[key] && <p className="mt-1 text-xs text-destructive">{errors[key]}</p>}</div>;
  return <section aria-label="Engineering rain attenuation — ITU climatology" className="space-y-4 border-t border-border pt-6">
    <h3 className="flex items-center gap-2 text-xl font-semibold"><Satellite className="size-5 shrink-0" /><RadioTower className="size-5 shrink-0" />Engineering rain attenuation — ITU climatology</h3>
    <p className="text-sm text-muted-foreground">Independent annual one-minute rainfall climatology: P.837-8. Land rainfall baseline 1951–2000 (GPCC V2015); water baseline 1979–2014 (ERA Interim). Not the IMERG demonstration’s 2005–2024 period.</p>
    <div role="status" className="border-l-4 border-comparison-b bg-notice p-3 text-sm text-notice-foreground"><strong>Attenuation map unavailable — ITU redistribution permission required.</strong> Official P.837-8 R0.01 and P.839-4 rain-height grids were acquired and inspected, but ITU’s published terms prohibit redistribution or derivative assets without prior written permission. No public spatial assets are installed; no map or point attenuation values are fabricated.</div>
    <div className="flex flex-wrap gap-2"><Button variant={mode === "satellite" ? "default" : "outline"} onClick={() => setMode("satellite")}><Satellite />Satellite</Button><Button variant={mode === "terrestrial" ? "default" : "outline"} onClick={() => setMode("terrestrial")}><RadioTower />Terrestrial</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {field("itu-f", "Frequency (GHz)", frequency, setFrequency, "frequencyGHz")}
      {field("itu-p", "Annual exceedance p (%)", p, setP, "pPercent")}
      <div><Label>Polarization</Label><Select value={polarization} onValueChange={v => setPolarization(v as Scenario["polarization"])}><SelectTrigger aria-label="ITU polarization"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="horizontal">Horizontal</SelectItem><SelectItem value="vertical">Vertical</SelectItem><SelectItem value="circular">Circular</SelectItem></SelectContent></Select></div>
      {mode === "satellite" ? <>{field("itu-el", "Reference elevation (degrees)", elevation, setElevation, "elevationDeg")}{field("itu-alt", "Assumed station altitude (m ASL)", altitude, setAltitude, "altitudeKmAsl")}</> : <>{field("itu-d", "Hypothetical reference distance (km)", distance, setDistance, "distanceKm")}{field("itu-h1", "Assumed first antenna altitude (m ASL)", h1, setH1, "antenna1KmAsl")}{field("itu-h2", "Assumed second antenna altitude (m ASL)", h2, setH2, "antenna2KmAsl")}</>}
    </div>
    <div className="flex flex-wrap gap-2">{["0.001", "0.01", "0.1", "1"].map(v => <Button key={v} size="sm" variant={p === v ? "default" : "outline"} onClick={() => setP(v)}>{v}%</Button>)}</div>
    <p className="text-xs text-muted-foreground">All altitudes are explicit assumed metres above mean sea level, not heights above terrain. Terrestrial paths requiring P.530-19’s combined wet-snow model must be masked, not presented as liquid-rain predictions.</p>
    <Button disabled={Object.keys(errors).length > 0} onClick={() => setSubmitted(structuredClone(s))}>Calculate attenuation map</Button>
    {submitted && <div className="space-y-2"><p role="alert" className="text-sm text-notice-foreground">Calculation blocked: genuine ITU inputs are not installed with redistribution permission. No grid, contours or point curve generated.</p>{JSON.stringify(submitted) !== JSON.stringify(s) && <p role="status" className="text-sm">Scenario changed; the submitted request below retains its original settings.</p>}<p className="text-xs">Submitted hypothetical {submitted.mode} reference scenario · {submitted.frequencyGHz} GHz · {submitted.polarization} · p={submitted.pPercent}% (fraction {submitted.pPercent / 100}).</p><Button variant="outline" onClick={() => downloadJson("itu-unavailable-scenario.json", JSON.stringify({ scenario: submitted, calculationVersion: MODEL_VERSION, revisions: REVISIONS, status: "blocked_no_redistribution_permission", outputs: null, extent: { west: 102, south: 1, east: 104, north: 3 }, sourcePeriod: "GPCC V2015 land 1951–2000; ERA Interim water 1979–2014", altitudeDatum: "assumed ASL", rainfallLookup: "representative link centre", inputAssetHashes: null, pConvention: "percentage; 0.01 means 0.01%, not fraction", endorsement: "No ITU endorsement" }, null, 2))}><Download />Submitted request / limitation JSON</Button></div>}
    <p className="text-xs text-muted-foreground">Ap is predicted rain attenuation exceeded for p% of an average year. A matching fade allowance addresses rain-only availability, not total system availability.</p>
    <a href="https://www.itu.int/en/about/Pages/terms-of-use.aspx" target="_blank" rel="noreferrer" className="text-xs underline">ITU terms and permission requirement</a>
  </section>;
}