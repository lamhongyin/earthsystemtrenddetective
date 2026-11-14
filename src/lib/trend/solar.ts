import { annualize, parsePowerMonthly, type MonthlyObservation } from "./parse";
import { CANONICAL_UNIT_VERSION, SOLAR_CODE, communityFor } from "./config";
export type SolarMetadata = { originalUnit: string; normalizedUnit: string; conversion: string; factor: number; description: string; community: string; temporalResolution: string; canonicalUnitVersion: string; negativeMonths: string[] };
export function solarUnitConversion(originalUnit: string, fullDayAverageVerified = false) {
  const u = originalUnit.toLowerCase().replace(/²/g, "^2").replace(/\s/g, "").replace(/kw-hr|kwh/g, "kwh");
  if (["kwh/m^2/day", "kwh/m2/day"].includes(u)) return { factor: 1, conversion: "Retain mean daily energy" };
  if (["mj/m^2/day", "mj/m2/day"].includes(u)) return { factor: 1 / 3.6, conversion: "MJ/m²/day ÷ 3.6" };
  if (["wh/m^2/day", "wh/m2/day"].includes(u)) return { factor: 1 / 1000, conversion: "Wh/m²/day ÷ 1000" };
  if (["w/m^2", "w/m2"].includes(u) && fullDayAverageVerified) return { factor: 24 / 1000, conversion: "Verified full-day average W/m² × 24/1000" };
  throw new Error(`Solar units ${originalUnit || "(missing)"} are unsupported or lack verified full-day averaging. Use NASA RE monthly data with documented energy units; no values were relabeled.`);
}
export function parseSolarMonthly(payload: unknown, start?: number, end?: number) {
  const p = payload as { parameters?: Record<string, { units?: string; longname?: string }> };
  const meta = p?.parameters?.[SOLAR_CODE];
  const originalUnit = meta?.units ?? "";
  // Flux units are deliberately rejected here: monthly metadata alone cannot verify full-day averaging.
  const conversion = solarUnitConversion(originalUnit);
  const parsed = parsePowerMonthly(payload, SOLAR_CODE, start, end);
  const negativeMonths = parsed.filter(r => r.value < 0).map(r => r.date);
  const raw = parsed.filter(r => r.value >= 0);
  if (!raw.length) throw new Error("No valid nonnegative solar months were returned; revise the location or period.");
  const monthly = raw.map(r => ({ ...r, value: r.value * conversion.factor }));
  const metadata: SolarMetadata = { originalUnit, normalizedUnit: "kWh/m²/day", ...conversion, description: meta?.longname ?? "Global Horizontal Irradiance", community: communityFor(SOLAR_CODE), temporalResolution: "monthly", canonicalUnitVersion: CANONICAL_UNIT_VERSION, negativeMonths };
  return { monthly, raw, metadata };
}
export const solarAnnual = (monthly: MonthlyObservation[]) => annualize(monthly, "weighted_mean").map(r => ({ ...r, total: monthly.filter(m => m.year === r.year).reduce((sum, m) => sum + m.value * m.days, 0) }));