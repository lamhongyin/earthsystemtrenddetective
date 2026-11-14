import type { AnnualObservation, MonthlyObservation } from "./parse";
const esc = (v: string | number) => { const s = String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const annualCsv = (code: string, unit: string, rows: AnnualObservation[]) =>
  [["year", `${code}_${unit}`], ...rows.map((r) => [r.year, r.value])].map((r) => r.map(esc).join(",")).join("\n") + "\n";
export const monthlyCsv = (rows: MonthlyObservation[]) =>
  [["date", "value"], ...rows.map((r) => [r.date, r.value])].map((r) => r.map(esc).join(",")).join("\n") + "\n";
export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const signed = (v: number, d = 3) => (v > 0 ? "+" : "") + v.toFixed(d);
