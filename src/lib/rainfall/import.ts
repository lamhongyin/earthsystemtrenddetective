import Papa from "papaparse";
import { contentHash, conversion, monthKey, rainRow, validBounds, type RainSeries, type RainUnit, type Support } from "./data";
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export type CsvInspection = { headers: string[]; metadata: Record<string, string>; table: string[][]; text: string; suggestedDate: string; suggestedValue: string };
export function inspectCsv(text: string): CsvInspection {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw new Error("CSV limit is 2 MB.");
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"), { skipEmptyLines: "greedy", delimiter: ",", newline: "\n" });
  if (result.errors.length) throw new Error(`Malformed CSV: ${result.errors[0]?.message}`);
  const rows = result.data;
  const index = rows.findIndex(r => r.some(v => /^(time|date|month|datetime|timestamp)$/i.test(v.trim())) && r.length >= 2);
  if (index < 0) throw new Error("No monthly time/date table header found.");
  const headers = (rows[index] ?? []).map(v => v.trim());
  if (new Set(headers).size !== headers.length) throw new Error("Duplicate column names are not supported.");
  const metadata: Record<string, string> = {};
  for (const r of rows.slice(0, index)) { if (r.length >= 2) metadata[(r[0] ?? "").trim()] = r.slice(1).join(",").trim(); else { const s = r[0] ?? "", at = s.indexOf(":"); if (at > 0) metadata[s.slice(0, at).replace(/^#\s*/, "").trim()] = s.slice(at + 1).trim(); } }
  return { headers, metadata, table: rows.slice(index + 1).filter(r => r.some(v => v.trim())), text, suggestedDate: headers.find(v => /^(time|date|month|datetime|timestamp)$/i.test(v)) ?? "", suggestedValue: headers.find(v => /precipitation|PRECTOTCORR/i.test(v) && !/quality|error|probability|uncertainty/i.test(v)) ?? "" };
}
export type ImportReview = { dateColumn: string; valueColumn: string; unit: RainUnit; sourceId: "POWER" | "IMERG"; datasetId: string; version: string; variable: string; support: Support; timeConvention: string; citation: string; sourceLink: string; fillValues: string; intervalConfirmed: boolean };
export function safeSourceLink(value: string) {
  if (!value.trim()) return "";
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password || !/^(?:[a-z0-9-]+\.)*(?:nasa\.gov|earthdata\.nasa\.gov)$/.test(u.hostname) || /token|secret|password|credential|signature|authorization|key/i.test(u.search + u.hash)) throw new Error("Use a public NASA HTTPS provenance link without credentials or token parameters.");
  return u.href;
}
export async function importGiovanni(csv: CsvInspection, review: ImportReview): Promise<RainSeries> {
  if (/token\s*[=:]|password\s*[=:]|authorization\s*[=:]|credential\s*[=:]|signature\s*[=:]|[?&]key=/i.test(csv.text + JSON.stringify(review))) throw new Error("Remove credential-bearing metadata or URLs before importing a scientific export.");
  validBounds(review.support.bounds);
  if (!review.intervalConfirmed) throw new Error("Confirm that each row represents a complete calendar month, not a daily or partial-month interval.");
  if (!review.citation.trim() || !review.timeConvention.trim() || !review.support.mask.trim() || !review.support.aggregation.trim() || !review.support.resolution.trim() || !review.support.spatialCoverage.trim()) throw new Error("Complete the source and spatial metadata review.");
  if (review.sourceId === "IMERG" && (review.datasetId !== "GPM_3IMERGM_07" || !/^07(?:B)?$/.test(review.version) || review.variable !== "GPM_3IMERGM_07_precipitation")) throw new Error("Only IMERG monthly Final Run v07 merged precipitation is supported; quality and uncertainty fields are not rainfall.");
  if (review.sourceId === "POWER" && (review.variable !== "PRECTOTCORR" || review.datasetId !== "POWER PRECTOTCORR")) throw new Error("The regional POWER import must be actual POWER PRECTOTCORR, not MERRA-2 through Giovanni.");
  const di = csv.headers.indexOf(review.dateColumn), vi = csv.headers.indexOf(review.valueColumn);
  if (di < 0 || vi < 0 || di === vi || /quality|error|probability|uncertainty|phase/i.test(review.valueColumn)) throw new Error("Select a date and a rainfall value column, not a quality/error field.");
  if (!["mm/day", "mm/hour", "kg/m2/s", "mm"].includes(review.unit)) throw new Error("Identify the original units; unknown units are not converted.");
  if (review.sourceId === "IMERG" && review.support.mode === "point" && (review.support.bounds.east - review.support.bounds.west > 0.100001 || review.support.bounds.north - review.support.bounds.south > 0.100001)) throw new Error("IMERG point support must be a native 0.1° cell; larger areas are regional series.");
  const fills = new Set(["", "null", "nan", "na", "n/a", "-999", "-9999", "-9999.9", ...review.fillValues.split(",").map(v => v.trim().toLowerCase())]);
  const seen = new Set<string>();
  const rows = csv.table.map(r => {
    const month = monthKey(r[di] ?? "");
    if (seen.has(month)) throw new Error(`Duplicate month ${month}; no silent duplicate resolution is applied.`);
    seen.add(month);
    const raw = (r[vi] ?? "").trim(), n = fills.has(raw.toLowerCase()) ? null : Number(raw);
    if (n !== null && !Number.isFinite(n)) throw new Error(`Invalid rainfall number for ${month}.`);
    return rainRow(month, n, review.unit);
  }).sort((a, b) => a.month.localeCompare(b.month));
  if (!rows.length || rows.length > 1200 || !rows.some(r => r.valueMm !== null)) throw new Error("Import requires 1–1200 monthly rows with at least one valid rainfall value.");
  const sourceLink = safeSourceLink(review.sourceLink);
  return { sourceId: review.sourceId, datasetId: review.datasetId, version: review.version, run: review.sourceId === "IMERG" ? "Final" : "bias-corrected", variable: review.variable, originalUnit: review.unit, quantityType: "calendar-month accumulated depth", temporalResolution: "calendar month", conversion: conversion(review.unit), timeConvention: review.timeConvention, support: { ...review.support }, accessRoute: review.sourceId === "IMERG" ? "Giovanni CSV import (user-supplied; reviewed metadata)" : "POWER regional CSV import (user-supplied; reviewed metadata)", retrievedAt: new Date().toISOString(), citation: review.citation, sourceLink, sha256: await contentHash(csv.text), originalText: csv.text, rows };
}