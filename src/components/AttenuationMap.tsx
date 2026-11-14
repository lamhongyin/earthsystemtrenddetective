import L from "leaflet";
import { useEffect, useRef } from "react";
import type { MapResult } from "@/lib/attenuation/local";
export default function AttenuationMap({ result, onPoint }: { result: MapResult; onPoint: (lat: number, lon: number) => void }) {
  const host = useRef<HTMLDivElement>(null), callback = useRef(onPoint); callback.current = onPoint;
  useEffect(() => {
    if (!host.current) return;
    const map = L.map(host.current, { scrollWheelZoom: false, preferCanvas: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap · locally evaluated ITU climatology" }).addTo(map);
    const css = getComputedStyle(document.documentElement), colors = Array.from({ length: 5 }, (_, i) => css.getPropertyValue(`--spatial-value-${i}`).trim());
    const b = result.scenario.extent, max = result.levels.at(-1) ?? 1;
    L.geoJSON({ type: "FeatureCollection", features: result.features }, {
      interactive: false,
      style: feature => {
        const lower = Number(feature?.properties?.lowerDb ?? 0), meets = feature?.properties?.rainFadeAllowanceMeets;
        return { fillColor: colors[Math.min(4, Math.floor(lower / max * 5))], fillOpacity: .72, stroke: result.scenario.marginDb !== null && meets === true, color: css.getPropertyValue("--success").trim(), weight: 1 };
      },
    }).addTo(map);
    L.rectangle([[b.south, b.west], [b.north, b.east]], { fill: false, color: css.getPropertyValue("--primary").trim(), weight: 1 }).addTo(map);
    let marker: L.CircleMarker | null = null;
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (lat < b.south || lat > b.north || lng < b.west || lng > b.east) return;
      marker?.remove(); marker = L.circleMarker(e.latlng, { radius: 5, color: css.getPropertyValue("--foreground").trim(), fillColor: css.getPropertyValue("--background").trim(), fillOpacity: 1 }).addTo(map);
      callback.current(lat, lng);
    });
    map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [15, 15] });
    return () => { map.remove(); };
  }, [result]);
  return <div ref={host} className="spatial-map h-[420px] w-full border border-border" aria-label="Filled contour attenuation map" />;
}