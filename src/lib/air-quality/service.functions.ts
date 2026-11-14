import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const point = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
export const fetchAirQuality = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ points: z.array(point).min(1).max(2), horizon: z.union([z.literal(24), z.literal(72), z.literal(120)]) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true; resultJson: string } | { ok: false; error: string }> => {
    const base = process.env['FORECAST_SERVICE_URL'], token = process.env['FORECAST_SERVICE_TOKEN'];
    if (!base || !token) return { ok: false, error: "Air Quality needs the updated Python service’s HTTPS address. NASA data is public, but this app’s hosting connection is not configured. Weather and solar analysis remain available." };
    let url: URL;
    try { url = new URL(base); if (url.protocol !== "https:") throw new Error(); } catch { return { ok: false, error: "Air Quality service address must use HTTPS." }; }
    url.pathname = `${url.pathname.replace(/\/$/, "")}/air-quality`; url.search = ""; url.hash = "";
    try {
      const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(data), signal: AbortSignal.timeout(150_000) });
      if (!response.ok) {
        const body = await response.text();
        console.error(`Air quality service failed [${response.status}]: ${body}`);
        let detail = "NASA retrieval failed; no substitute data returned.";
        try { const parsed = JSON.parse(body) as { detail?: unknown }; if (typeof parsed.detail === "string") detail = parsed.detail; } catch { /* Do not display upstream HTML. */ }
        if (response.status === 404) detail = "The hosted service needs the Air Quality update. Redeploy the updated service.";
        return { ok: false, error: `Air Quality (${response.status}): ${detail}` };
      }
      return { ok: true, resultJson: JSON.stringify(await response.json()) };
    } catch { return { ok: false, error: "NASA Air Quality service is unavailable or timed out. Retained estimates are not current; retry when the service is restored." }; }
  });