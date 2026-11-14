import type { AirResult, AirWindow } from "./types";
export function selectedHours(r: AirResult, horizon: number, now: number) {
  const start = Math.floor(now / 3600_000) * 3600_000;
  return r.hours.filter(h => Date.parse(h.intervalStart) >= start && Date.parse(h.intervalEnd) <= start + horizon * 3600_000);
}
export function latestAt<T>(rows: T[], end: (r: T) => string, now: number): T | undefined {
  const past = rows.filter(r => Date.parse(end(r)) <= now);
  return past.at(-1) ?? rows[0];
}
export function peakIndex(rows: AirWindow[]) {
  return rows.filter(w => w.aboveScale || w.aqi !== null).sort((a, b) => Number(b.aboveScale) - Number(a.aboveScale) || (b.aqi ?? 0) - (a.aqi ?? 0))[0];
}
export function sameGrid(a: AirResult, b: AirResult) {
  return a.snapshotId === b.snapshotId && a.gridPoint.latitude === b.gridPoint.latitude && a.gridPoint.longitude === b.gridPoint.longitude;
}
export function alignedSeries(results: AirResult[], view: string, horizon: number, now: number) {
  const rows = results.map(r => {
    const selected = selectedHours(r, horizon, now);
    const times = new Set(selected.map(h => h.intervalEnd));
    return view === "hourly" ? selected.map(h => ({ time: h.intervalEnd, value: h.pm25 })) : (view === "daily" ? r.daily.filter(w => w.start >= (selected[0]?.intervalStart ?? "~") && w.end <= (selected.at(-1)?.intervalEnd ?? "")) : r.windows24h.filter(w => times.has(w.end))).map(w => ({ time: w.end, value: w.aqi }));
  });
  const first = rows[0] ?? [];
  return first.filter(p => rows.length === 1 || rows[1]?.some(q => q.time === p.time)).map(p => ({ time: p.time, A: p.value, B: rows[1]?.find(q => q.time === p.time)?.value ?? null }));
}