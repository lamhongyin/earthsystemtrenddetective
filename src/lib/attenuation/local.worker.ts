import { LOCAL_INPUTS, evaluate, filledBands, pointCurve, provenance, validateMap, type GridKind, type LocalGrids, type MapScenario, type MapResult } from "./local";
type Message = { id: number; action: "load" | "restore" | "remember" | "remove" | "calculate" | "point" | "cancel"; kind?: GridKind; file?: File; remember?: boolean; scenario?: MapScenario; lat?: number; lon?: number };
let rain: Float64Array | null = null, height: Float64Array | null = null;
let rainFile: File | null = null, heightFile: File | null = null;
let remember = false, generation = 0;
const yieldUi = () => new Promise<void>(r => setTimeout(r, 0));
const send = (id: number, type: string, data: unknown) => postMessage({ id, type, data });
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const r = indexedDB.open("itu-local-verified-v1", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new Error("On-device storage unavailable; use session-only mode.")); });
}
async function cache(action: "read" | "write" | "clear", value?: { rain: File; height: File }) {
  const db = await database();
  try { return await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction("files", action === "read" ? "readonly" : "readwrite"), store = tx.objectStore("files");
    const req = action === "read" ? store.get("verified") : action === "clear" ? store.clear() : store.put(value, "verified");
    tx.oncomplete = () => resolve(req.result); tx.onerror = () => reject(new Error("Local storage failed; verified data remains session-only."));
  }); } finally { db.close(); }
}
async function parse(file: File, kind: GridKind, id: number, token: number): Promise<Float64Array> {
  const m = LOCAL_INPUTS[kind];
  if (file.size <= 0 || file.size > m.maxBytes) throw new Error(`Select extracted ${m.name}, not a ZIP; maximum ${m.maxBytes / 1000000} MB.`);
  send(id, "status", `Checking original ${m.name} SHA-256…`);
  const raw = await file.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", raw))].map(v => v.toString(16).padStart(2, "0")).join("");
  if (hash !== m.hash) throw new Error(`${m.name} does not match the verified ${kind === "rain" ? "P.837-8" : "P.839-4"} original. Download the stated revision and select its unchanged extracted text file; do not resave it.`);
  const lines = new TextDecoder().decode(raw).trim().split(/\r?\n/);
  if (lines.length !== m.rows) throw new Error(`${m.name}: expected ${m.rows} rows.`);
  const values = new Float64Array(m.rows * m.cols);
  for (let row = 0; row < lines.length; row++) {
    if (token !== generation) throw new Error("Cancelled");
    const cells = (lines[row] ?? "").trim().split(/\s+/);
    if (cells.length !== m.cols) throw new Error(`${m.name}: row ${row + 1} must have ${m.cols} columns.`);
    for (let col = 0; col < cells.length; col++) { const v = Number(cells[col]); if (!Number.isFinite(v) || v < 0) throw new Error(`${m.name}: invalid value at row ${row + 1}, column ${col + 1}.`); values[row * m.cols + col] = v; }
    if (row % 40 === 0) { send(id, "status", `Parsing ${m.name}: ${Math.round(row / m.rows * 100)}%`); await yieldUi(); }
  }
  for (let row = 0; row < m.rows; row++) if (values[row * m.cols] !== values[row * m.cols + m.cols - 1]) throw new Error(`${m.name}: duplicated longitude seam differs.`);
  return values;
}
async function saveIfOptedIn() { if (remember && rainFile && heightFile) await cache("write", { rain: rainFile, height: heightFile }); }
function grids(): LocalGrids { if (!rain || !height) throw new Error("Select and verify both official extracted files first."); return { rain, height }; }
self.onmessage = async (event: MessageEvent<Message>) => {
  const m = event.data;
  if (m.action === "cancel") { generation++; return; }
  try {
    if (m.action === "remove") { generation++; rain = null; height = null; rainFile = null; heightFile = null; remember = false; await cache("clear"); send(m.id, "removed", null); return; }
    if (m.action === "remember") { remember = !!m.remember; if (remember) await saveIfOptedIn(); else await cache("clear"); send(m.id, "remembered", remember); return; }
    if (m.action === "load" && m.file && m.kind) {
      if (m.kind === "rain") { rain = null; rainFile = null; } else { height = null; heightFile = null; }
      if (remember) await cache("clear");
      const token = ++generation, values = await parse(m.file, m.kind, m.id, token); if (token !== generation) return;
      if (m.kind === "rain") { rain = values; rainFile = m.file; } else { height = values; heightFile = m.file; }
      await saveIfOptedIn(); send(m.id, "ready", { rain: !!rain, height: !!height, remembered: remember }); return;
    }
    if (m.action === "restore") {
      const stored = await cache("read") as { rain?: File; height?: File } | undefined;
      if (!stored?.rain || !stored.height) { send(m.id, "ready", { rain: false, height: false, remembered: false }); return; }
      const token = ++generation;
      const r = await parse(stored.rain, "rain", m.id, token), h = await parse(stored.height, "height", m.id, token);
      if (token !== generation) return;
      rain = r; height = h; rainFile = stored.rain; heightFile = stored.height; remember = true;
      send(m.id, "ready", { rain: true, height: true, remembered: true }); return;
    }
    if (m.action === "point" && m.scenario && m.lat !== undefined && m.lon !== undefined) { const g = grids(); send(m.id, "point", { point: evaluate(g, m.scenario, m.lat, m.lon), curve: pointCurve(g, m.scenario, m.lat, m.lon) }); return; }
    if (m.action === "calculate" && m.scenario) {
      const s = m.scenario, errors = validateMap(s); if (Object.keys(errors).length) throw new Error(Object.values(errors).join(" "));
      const g = grids(), token = ++generation, b = s.extent;
      const columns = Math.ceil((b.east - b.west) / s.spacingDeg) + 1, rows = Math.ceil((b.north - b.south) / s.spacingDeg) + 1;
      const points: MapResult["points"] = [], reasons: Record<string, number> = {};
      for (let y = 0; y < rows; y++) {
        if (token !== generation) return;
        for (let x = 0; x < columns; x++) { const p = evaluate(g, s, Math.min(b.north, b.south + y * s.spacingDeg), Math.min(b.east, b.west + x * s.spacingDeg)); points.push(p); reasons[p.reason] = (reasons[p.reason] ?? 0) + 1; }
        if (y % 4 === 0) { send(m.id, "status", `Calculating local map: ${Math.round(y / rows * 100)}%`); await yieldUi(); }
      }
      const max = points.reduce((v, p) => Math.max(v, p.apDb ?? 0), 0);
      if (max / s.intervalDb > 63) throw new Error("More than 64 contour bands; increase the contour interval. Scenario was not changed.");
      const levels = Array.from({ length: Math.max(2, Math.ceil(max / s.intervalDb) + 1) }, (_, i) => i * s.intervalDb);
      if (s.marginDb !== null && s.marginDb > 0 && s.marginDb < (levels.at(-1) ?? 0) && !levels.includes(s.marginDb)) levels.push(s.marginDb);
      levels.sort((a, b) => a - b);
      const features = filledBands(points, columns, rows, levels, s.marginDb), submittedAt = new Date().toISOString();
      if (token !== generation) return;
      send(m.id, "map", { scenario: s, submittedAt, points, features, levels, columns, rows, validCount: points.filter(p => p.valid).length, reasons, provenance: provenance(s, submittedAt) } satisfies MapResult);
    }
  } catch (e) { if (!(e instanceof Error && e.message === "Cancelled")) send(m.id, "error", e instanceof Error ? e.message : "Local calculation failed."); }
};