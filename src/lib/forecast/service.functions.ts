import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { minYearFor } from "@/lib/trend/config";
import type { ForecastJob } from "./types";
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const settings = z.object({
  parameter: z.enum(["T2M", "PRECTOTCORR", "RH2M", "WS10M", "ALLSKY_SFC_SW_DWN"]), latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180),
  start: month, end: month, horizon: z.number().int().min(1).max(24), level: z.union([z.literal(0.8), z.literal(0.9), z.literal(0.95)]),
  model: z.enum(["auto", "seasonal_naive", "gradient_boosted"]), observations: z.array(z.object({ month, value: z.number().finite() })).min(1).max(600),
  provenance: z.record(z.unknown()),
}).refine(d => d.start <= d.end && Number(d.start.slice(0, 4)) >= minYearFor(d.parameter) && Number(d.end.slice(0, 4)) <= 2025, "Training years must be ordered between 1981 and 2025.");
const command = z.discriminatedUnion("action", [z.object({ action: z.literal("check") }), z.object({ action: z.literal("submit"), request: settings }), z.object({ action: z.literal("poll"), id: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) }), z.object({ action: z.literal("cancel"), id: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) })]);
export const forecastService = createServerFn({ method: "POST" }).inputValidator((input: unknown) => command.parse(input)).handler(async ({ data }): Promise<{ ok: true; jobJson: string } | { ok: false; error: string }> => {
  const base = process.env['FORECAST_SERVICE_URL'], token = process.env['FORECAST_SERVICE_TOKEN'];
  if (!base || !token) return { ok: false, error: "Forecast training service is not connected. A separately hosted Python service and its service credential are required; historical analysis remains available." };
  let url: URL;
  try { url = new URL(base); if (url.protocol !== "https:") throw new Error(); } catch { return { ok: false, error: "Forecast service requires a valid HTTPS hosting address." }; }
  if (data.action === "check") return { ok: true, jobJson: JSON.stringify({ id: "", status: "queued" }) };
  url.pathname = `${url.pathname.replace(/\/$/, "")}/jobs${data.action === "submit" ? "" : `/${data.id}`}`;
  url.search = ""; url.hash = "";
  try {
    const response = await fetch(url, { method: data.action === "submit" ? "POST" : data.action === "cancel" ? "DELETE" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(data.action === "submit" ? { body: JSON.stringify(data.request) } : {}) });
    if (!response.ok) {
      let detail = "Forecast service rejected the request.";
      try { const error = await response.json() as { detail?: unknown }; if (typeof error.detail === "string") detail = error.detail; } catch { /* do not expose upstream HTML */ }
      return { ok: false, error: `Forecast service (${response.status}): ${detail}` };
    }
    const job = await response.json() as ForecastJob;
    return { ok: true, jobJson: JSON.stringify(job) };
  } catch { return { ok: false, error: "Forecast training service is unavailable. Historical analysis is unaffected; try again when the service is restored." }; }
});
