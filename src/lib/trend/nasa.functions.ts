import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PARAMETER_CODES, POWER_ENDPOINT, MIN_YEAR, MAX_YEAR } from "./config";

const Input = z.object({
  parameter: z.enum(PARAMETER_CODES as [string, ...string[]]),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  start: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  end: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
});

export type PowerResult = { ok: true; payload: string } | { ok: false; error: string };
const TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; payload: string }>();

// Same-origin proxy to the single fixed NASA POWER monthly endpoint (no arbitrary URLs).
export const fetchPowerMonthly = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<PowerResult> => {
    const key = `${data.parameter}|${data.latitude}|${data.longitude}|${data.start}|${data.end}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return { ok: true, payload: hit.payload };
    const url = new URL(POWER_ENDPOINT);
    url.search = new URLSearchParams({
      parameters: data.parameter, community: "AG",
      longitude: String(data.longitude), latitude: String(data.latitude),
      start: String(data.start), end: String(data.end), format: "JSON",
    }).toString();
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(90_000), headers: { accept: "application/json" } });
    } catch (e) {
      const name = (e as Error)?.name;
      if (name === "TimeoutError" || name === "AbortError")
        return { ok: false, error: "NASA POWER did not respond within 90 seconds. Try again, or choose a shorter period." };
      return { ok: false, error: `Could not reach NASA POWER (${(e as Error)?.message ?? "network error"}).` };
    }
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 400);
      try { const j = JSON.parse(text); detail = JSON.stringify(j.messages ?? j.detail ?? j.errors ?? j).slice(0, 400); } catch { /* keep text */ }
      if (res.status === 429) return { ok: false, error: "NASA POWER rate limit reached. Please wait a minute and retry." };
      return { ok: false, error: `NASA POWER returned HTTP ${res.status}: ${detail}` };
    }
    try { JSON.parse(text); } catch { return { ok: false, error: "NASA POWER returned a response that is not valid JSON." }; }
    cache.set(key, { at: Date.now(), payload: text });
    return { ok: true, payload: text };
  });
