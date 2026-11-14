import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchPlace = { id: string; label: string; address: string; lat: number; lon: number; country: boolean; attributions: { name: string; uri: string }[] };
export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ query: z.string().trim().min(2).max(200) }).parse(input))
  .handler(async ({ data }): Promise<{ places: SearchPlace[]; error: string | null }> => {
    const key = process.env['GOOGLE_MAPS_API_KEY'];
    const lovableKey = process.env['LOVABLE_API_KEY'];
    if (!key || !lovableKey) return { places: [], error: "Google place search is not configured. Connect Google Maps in project settings; presets and coordinates remain available." };
    try {
      const response = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText", {
        method: "POST", signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": key, "Content-Type": "application/json", "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.attributions" },
        body: JSON.stringify({ textQuery: data.query, pageSize: 8, languageCode: "en" }),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error(`Google Places [${response.status}]: ${body}`);
        let reason: string | undefined;
        try { const parsed = JSON.parse(body); reason = parsed?.error?.details?.find((d: { reason?: string }) => d.reason)?.reason; } catch { /* response may be text */ }
        const fix = reason === "API_KEY_HTTP_REFERRER_BLOCKED" ? "The Google server key must allow server requests, not website referrers." : reason === "API_KEY_SERVICE_BLOCKED" ? "Enable Places API (New) on the Google server key." : "Check Google Maps configuration or quota.";
        return { places: [], error: `Google Places returned HTTP ${response.status}: ${body}. ${fix}` };
      }
      const payload = await response.json() as { places?: { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number }; types?: string[]; attributions?: { provider?: string; providerUri?: string }[] }[] };
      const places = (payload.places ?? []).flatMap(p => {
        const lat = p.location?.latitude, lon = p.location?.longitude;
        if (!p.id || typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
        return [{ id: p.id, label: p.displayName?.text ?? p.formattedAddress ?? "Selected point", address: p.formattedAddress ?? "", lat, lon, country: p.types?.includes("country") ?? false, attributions: (p.attributions ?? []).map(a => ({ name: a.provider ?? "", uri: a.providerUri ?? "" })).filter(a => a.uri.startsWith("https://")) }];
      });
      // No persistent geocoder cache or automatic retries: explicit searches only, at most eight results.
      return { places, error: null };
    } catch (e) { return { places: [], error: `Place search failed: ${e instanceof Error ? e.message : String(e)}. Presets and coordinates remain available.` }; }
  });