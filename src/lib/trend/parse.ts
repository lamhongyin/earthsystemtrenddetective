import type { Aggregation } from "./config";

export type MonthlyObservation = { date: string; value: number; year: number; days: number };
export type AnnualObservation = { year: number; value: number };

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toFinite(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parsePowerMonthly(payload: unknown, parameter: string, startYear?: number, endYear?: number): MonthlyObservation[] {
  const p = payload as { properties?: { parameter?: Record<string, unknown> }; messages?: unknown; detail?: unknown } | null;
  const data = p?.properties?.parameter?.[parameter];
  if (!data || typeof data !== "object") {
    const msg = p?.messages ?? p?.detail ?? "Data not returned";
    throw new Error(`Could not find ${parameter} in API response: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
  }
  const byDate = new Map<string, MonthlyObservation>();
  for (const [key, raw] of Object.entries(data as Record<string, unknown>)) {
    if (!/^\d{6}$/.test(key)) continue;
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(4, 6));
    if (month < 1 || month > 12) continue;
    if (startYear !== undefined && year < startYear) continue;
    if (endYear !== undefined && year > endYear) continue;
    const num = toFinite(raw);
    if (num === null || num <= -900) continue;
    const date = `${key.slice(0, 4)}-${key.slice(4, 6)}-01`;
    if (!byDate.has(date)) byDate.set(date, { date, value: num, year, days: daysInMonth(year, month) });
  }
  const rows = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!rows.length) throw new Error("No valid monthly observations were returned for this selection.");
  return rows;
}

export function annualize(monthly: MonthlyObservation[], aggregation: Aggregation): AnnualObservation[] {
  const groups = new Map<number, MonthlyObservation[]>();
  for (const m of monthly) {
    const g = groups.get(m.year) ?? [];
    g.push(m);
    groups.set(m.year, g);
  }
  const out: AnnualObservation[] = [];
  for (const year of [...groups.keys()].sort((a, b) => a - b)) {
    const g = groups.get(year)!;
    if (new Set(g.map((m) => m.date)).size !== 12) continue;
    const weighted = g.reduce((s, m) => s + m.value * m.days, 0);
    const days = g.reduce((s, m) => s + m.days, 0);
    out.push({ year, value: aggregation === "sum_from_daily_mean" ? weighted : weighted / days });
  }
  if (!out.length) throw new Error("No complete years with 12 valid months were available.");
  return out;
}
