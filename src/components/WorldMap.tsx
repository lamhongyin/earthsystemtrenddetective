/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { normalizeLongitude, validateCoords } from "@/lib/trend/config";
import type { Point } from "@/lib/trend/comparison";

declare global { interface Window { earthTrendMapReady?: () => void; gm_authFailure?: () => void } }
let mapsPromise: Promise<void> | undefined;
function loadMaps() {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<void>((resolve, reject) => {
    const key = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'];
    if (!key) { reject(new Error("Connect Google Maps to enable the world map. Coordinate inputs and presets remain available.")); return; }
    // Sandbox maps are unsupported; do not make live Google requests from localhost.
    if (window.location.hostname === "localhost") { reject(new Error("Google Maps is available on the authorized published site. Coordinate inputs and presets remain available here.")); return; }
    window.earthTrendMapReady = () => resolve();
    window.gm_authFailure = () => reject(new Error("Google Maps could not authorize this website. Check the connection and allowed domain; coordinate inputs remain available."));
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=earthTrendMapReady&channel=${encodeURIComponent(import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID'] ?? "")}`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps could not load. Use presets or coordinate inputs."));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error("Google Maps did not load in time. Use presets or coordinate inputs.")), 20000);
  });
  return mapsPromise;
}
export default function WorldMap({ a, b, compare, active, onSelect }: { a: Point; b: Point; compare: boolean; active: "A" | "B"; onSelect: (lat: number, lon: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const selectRef = useRef(onSelect); selectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    loadMaps().then(() => {
      if (disposed || !host.current) return;
      map.current = new google.maps.Map(host.current, { center: { lat: 15, lng: 30 }, zoom: 2, minZoom: 2, clickableIcons: false, streetViewControl: false, mapTypeControl: false, fullscreenControl: true, gestureHandling: "greedy" });
      map.current.addListener("click", (e: google.maps.MapMouseEvent) => { if (e.latLng) selectRef.current(e.latLng.lat(), normalizeLongitude(e.latLng.lng())); });
      setReady(true);
    }).catch(e => { if (!disposed) setError(e instanceof Error ? e.message : String(e)); });
    return () => { disposed = true; markers.current.forEach(m => m.setMap(null)); if (map.current) google.maps.event.clearInstanceListeners(map.current); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    markers.current.forEach(m => m.setMap(null));
    markers.current = ([{ point: a, id: "A" }, ...(compare ? [{ point: b, id: "B" }] : [])]).flatMap(({ point, id }) => {
      if (validateCoords(point.lat, point.lon)) return [];
      const colors = getComputedStyle(document.documentElement);
      return [new google.maps.Marker({ map: map.current, position: { lat: point.lat, lng: point.lon }, title: `${id}: ${point.label}`, label: { text: id, color: colors.getPropertyValue("--map-marker-text").trim() }, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: colors.getPropertyValue(id === "A" ? "--map-a" : "--map-b").trim(), fillOpacity: 1, strokeColor: colors.getPropertyValue("--map-marker-text").trim(), strokeWeight: 2 } })];
    });
    const target = active === "A" ? a : b;
    if (!validateCoords(target.lat, target.lon)) map.current.panTo({ lat: Math.max(-85, Math.min(85, target.lat)), lng: target.lon });
  }, [a, b, compare, active, ready]);
  return <div className="relative h-[340px] w-full overflow-hidden border border-border bg-muted sm:h-[400px]">
    <div ref={host} className="h-full w-full" aria-label={`World map — select location ${active}`} />
    {!ready && <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted-foreground" role="status">{error ?? "Loading world map…"}</div>}
  </div>;
}