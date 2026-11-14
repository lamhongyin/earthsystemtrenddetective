import { useEffect, useRef } from "react";
import L from "leaflet";
import { cellAt, type Raster } from "@/lib/spatial/data";
import type { Point } from "@/lib/trend/comparison";
export default function SpatialCanvasMap({ raster, opacity, low, high, a, b, compare, onPick, view, grid }: { raster: Raster | null; opacity: number; low: number; high: number; a: Point; b: Point; compare: boolean; onPick: (lat: number, lon: number) => void; view: string; grid: boolean }) {
 const host = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), layer = useRef<L.GridLayer | null>(null), markers = useRef<L.LayerGroup | null>(null);
 const pick = useRef(onPick); pick.current = onPick;
 useEffect(() => {
  if (!host.current) return;
  const m = L.map(host.current, { center: [12, 0], zoom: 2, minZoom: 1, maxZoom: 10, worldCopyJump: true }); map.current = m;
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 10, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
  m.attributionControl.addAttribution("NASA POWER • MERRA-2 / CERES • LST");
  m.on("click", (e: L.LeafletMouseEvent) => pick.current(e.latlng.lat, ((e.latlng.lng + 180) % 360 + 360) % 360 - 180));
  const observer = new ResizeObserver(() => m.invalidateSize()); observer.observe(host.current);
  return () => { observer.disconnect(); m.remove(); map.current = null; };
 }, []);
 useEffect(() => {
  const m = map.current; if (!m || !raster) return;
  const currentMap = m, currentRaster = raster;
  layer.current?.remove();
  const styles = getComputedStyle(document.documentElement), trend = raster.slice.mode === "trend";
  const stops = Array.from({ length: 5 }, (_, i) => styles.getPropertyValue(`--spatial-${trend ? "trend" : "value"}-${i}`).trim());
  const palette = document.createElement("canvas"); palette.width = 256; palette.height = 1;
  const ctx = palette.getContext("2d"); if (!ctx) return;
  const gradient = ctx.createLinearGradient(0, 0, 255, 0); stops.forEach((color, i) => gradient.addColorStop(i / 4, color));
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 1); const colors = ctx.getImageData(0, 0, 256, 1).data;
  class Tiles extends L.GridLayer { override createTile(coords: L.Coords) {
   const tile = document.createElement("canvas"); tile.width = 256; tile.height = 256;
   const context = tile.getContext("2d"); if (!context) return tile;
   const image = context.createImageData(256, 256);
   for (let y = 0; y < 256; y++) {
    const lat = currentMap.unproject(L.point(coords.x * 256, coords.y * 256 + y + 0.5), coords.z).lat;
    for (let x = 0; x < 256; x++) {
     const lon = currentMap.unproject(L.point(coords.x * 256 + x + 0.5, coords.y * 256), coords.z).lng;
     const cell = cellAt(currentRaster, lat, lon); if (!cell || cell.value === null) continue;
     const c = Math.round(Math.max(0, Math.min(1, (cell.value - low) / (high - low))) * 255) * 4, i = (y * 256 + x) * 4;
     image.data[i] = colors[c] ?? 0; image.data[i + 1] = colors[c + 1] ?? 0; image.data[i + 2] = colors[c + 2] ?? 0; image.data[i + 3] = 255;
     if (grid && coords.z >= 5) {
      const next = cellAt(currentRaster, lat, lon + 360 / (256 * 2 ** coords.z));
      const below = currentMap.unproject(L.point(coords.x * 256 + x, coords.y * 256 + y + 1.5), coords.z).lat;
      if (next?.index !== cell.index || cellAt(currentRaster, below, lon)?.index !== cell.index) image.data[i + 3] = 110;
     }
    }
   }
   context.putImageData(image, 0, 0); return tile;
  } }
  layer.current = new Tiles({ opacity: opacity / 100, updateWhenIdle: true, keepBuffer: 1 }).addTo(m);
 }, [raster, low, high, grid]);
 useEffect(() => { layer.current?.setOpacity(opacity / 100); }, [opacity]);
 useEffect(() => {
  const m = map.current; if (!m) return;
  markers.current?.remove(); const group = L.layerGroup().addTo(m); markers.current = group;
  for (const [id, point] of [["A", a], ...(compare ? [["B", b]] : [])] as [string, Point][]) {
   if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
   L.marker([point.lat, point.lon], { icon: L.divIcon({ className: `spatial-marker spatial-marker-${id.toLowerCase()}`, html: id, iconSize: [28, 28] }) }).addTo(group);
  }
 }, [a, b, compare]);
 useEffect(() => { if (view.startsWith("malaysia")) map.current?.setView([4, 109], 5); else if (view.startsWith("asia")) map.current?.setView([8, 110], 4); else map.current?.setView([12, 0], 2); }, [view]);
 return <div ref={host} className="spatial-map h-[420px] w-full sm:h-[520px]" aria-label="NASA global environmental raster map" />;
}
