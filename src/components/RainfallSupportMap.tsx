import L from "leaflet";
import { useEffect, useRef } from "react";
import type { Support } from "@/lib/rainfall/data";
export default function RainfallSupportMap({ supports }: { supports: { label: string; support: Support }[] }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current || !supports.length) return;
    const map = L.map(host.current, { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
    const styles = getComputedStyle(document.documentElement), extent = L.latLngBounds([]);
    supports.forEach(({ label, support }, i) => {
      const b = support.bounds, bounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);
      extent.extend(bounds);
      const tooltip = document.createElement("span"); tooltip.textContent = `${label}: ${support.mode === "region" ? "Regional series" : "source-cell footprint"}`;
      L.rectangle(bounds, { color: styles.getPropertyValue(i === 0 ? "--primary" : "--comparison-b").trim(), fillOpacity: 0.04, weight: 2 }).addTo(map).bindTooltip(tooltip);
    });
    map.fitBounds(extent, { padding: [25, 25], maxZoom: 9 });
    return () => { map.remove(); };
  }, [supports]);
  return <div ref={host} className="spatial-map h-[260px] w-full border border-border" aria-label="Rainfall source footprints — boundaries only, no rainfall raster" />;
}