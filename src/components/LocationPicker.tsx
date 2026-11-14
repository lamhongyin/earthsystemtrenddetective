import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { LOCATIONS } from "@/lib/trend/config";
import type { Point } from "@/lib/trend/comparison";
import { searchPlaces, type SearchPlace } from "@/lib/trend/search.functions";
import { supabase } from "@/integrations/supabase/client";
import { SearchSignIn } from "./SearchSignIn";

export type DraftPoint = { label: string; lat: string; lon: string; origin: NonNullable<Point["origin"]>; country?: boolean };
export const draftPoint = (p: Point): DraftPoint => ({ ...p, origin: p.origin ?? "coordinates", lat: String(p.lat), lon: String(p.lon) });
export const numericPoint = (p: DraftPoint): Point => ({ ...p, lat: p.lat.trim() ? Number(p.lat) : NaN, lon: p.lon.trim() ? Number(p.lon) : NaN });
export function LocationPicker({ id, point, onChange, disabled }: { id: "A" | "B"; point: DraftPoint; onChange: (p: DraftPoint) => void; disabled: boolean }) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<SearchPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const request = useRef(0);
  const target = useRef(id); target.current = id;
  const search = useServerFn(searchPlaces);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    void supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    return () => { subscription.unsubscribe(); request.current++; };
  }, []);
  useEffect(() => { request.current++; setPlaces([]); setError(null); setSearching(false); }, [id]);
  async function submit() {
    if (!signedIn || searching || query.trim().length < 2) return;
    const n = ++request.current, searchedTarget = id;
    setSearching(true); setError(null); setPlaces([]);
    try {
      const r = await search({ data: { query: query.trim() } });
      if (n !== request.current || target.current !== searchedTarget) return;
      setPlaces(r.places); setError(r.error ?? (r.places.length ? null : "No matching places found. Try a city and country, or enter coordinates."));
    } catch (e) { if (n === request.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (n === request.current) setSearching(false); }
  }
  const selectedPreset = LOCATIONS.find(p => p.label === point.label && String(p.lat) === point.lat && String(p.lon) === point.lon)?.label ?? "custom";
  return <div className="space-y-4">
    <div className="space-y-1.5"><Label htmlFor={`preset-${id}`}>Location {id} preset</Label>
      <Select value={selectedPreset} disabled={disabled} onValueChange={value => { const p = LOCATIONS.find(p => p.label === value); if (p) { request.current++; setSearching(false); setPlaces([]); onChange(draftPoint({ ...p, origin: "preset" })); } }}>
        <SelectTrigger id={`preset-${id}`} className="h-auto min-h-9 [&>span]:whitespace-normal"><SelectValue /></SelectTrigger>
        <SelectContent>{LOCATIONS.map(p => <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>)}<SelectItem value="custom">Selected point / custom coordinates</SelectItem></SelectContent>
      </Select>
    </div>
    <div className="space-y-2">
      <Label htmlFor={`search-${id}`}>Search places for location {id}</Label>
      <div className="flex gap-2"><Input id={`search-${id}`} value={query} placeholder="City, country or named place" disabled={disabled || !signedIn} onChange={e => { request.current++; setSearching(false); setQuery(e.target.value); setPlaces([]); setError(null); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }} /><Button type="button" size="icon" variant="outline" aria-label={`Search places for location ${id}`} disabled={disabled || !signedIn || searching || query.trim().length < 2} onClick={submit}><Search /></Button></div>
      {!signedIn && <SearchSignIn onSignedIn={() => setSignedIn(true)} />}
      {signedIn && <Button type="button" variant="link" size="sm" onClick={async () => { request.current++; setPlaces([]); setSearching(false); await supabase.auth.signOut(); }}>Sign out of search</Button>}
      {searching && <p role="status" className="text-sm text-muted-foreground">Searching places…</p>}
      {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
      {places.length > 0 && <ul className="max-h-64 overflow-auto divide-y divide-border border border-border rounded-md">{places.map(p => <li key={p.id}><Button type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal py-3 text-left" disabled={disabled} onClick={() => { onChange(draftPoint({ label: p.country ? `Point within ${p.label}; not a country average` : `${p.label}${p.address && p.address !== p.label ? ` · ${p.address}` : ""}`, lat: p.lat, lon: p.lon, origin: "search", country: p.country })); setPlaces([]); }}><MapPin className="shrink-0" /><span><span className="block">{p.label}</span><span className="block text-xs text-muted-foreground">{p.address}</span></span></Button>{p.attributions.map(a => <a key={a.uri} href={a.uri} target="_blank" rel="noreferrer" className="px-3 text-xs underline">{a.name}</a>)}</li>)}</ul>}
      <p className="text-xs text-muted-foreground">Place search: Google Maps · <a href="https://maps.google.com/help/terms_maps/" className="underline" target="_blank" rel="noreferrer">Terms</a> · <a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noreferrer">Privacy</a></p>
    </div>
    <div className="grid grid-cols-2 gap-2">{(["lat", "lon"] as const).map(axis => <div key={axis} className="space-y-1.5"><Label htmlFor={`${axis}-${id}`}>{axis === "lat" ? "Latitude" : "Longitude"} {id}</Label><Input id={`${axis}-${id}`} type="number" step="any" min={axis === "lat" ? -90 : -180} max={axis === "lat" ? 90 : 180} disabled={disabled} value={point[axis]} onChange={e => onChange({ ...point, [axis]: e.target.value, label: "Selected point", origin: "coordinates", country: false })} /></div>)}</div>
    <p className="break-words text-xs text-muted-foreground">{point.label}</p>
  </div>;
}