import { createServerFn } from "@tanstack/react-start";
// Discovery is not retrieval: do not expose an unverified automatic data action.
export const checkImergAccess = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const r = await fetch("https://api.giovanni.earthdata.nasa.gov/configured-variables/", { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return { available: false, message: "NASA catalogue is temporarily unavailable. Giovanni CSV imports remain separate from automatic retrieval.", checkedAt: new Date().toISOString() };
    const text = await r.text();
    const configured = text.includes('"GPM_3IMERGM_07_precipitation"');
    return { available: false, configured, message: configured ? "NASA lists GPM_3IMERGM_07_precipitation. Automatic monthly retrieval is not connected: the documented Giovanni/Harmony service requires project-owner Earthdata authorization and quota. Import a genuine Giovanni CSV; no IMERG case study is installed." : "The current cloud catalogue did not confirm the requested monthly v07 variable. Use a verified classic Giovanni export; no automatic retrieval is claimed.", checkedAt: new Date().toISOString() };
  } catch { return { available: false, message: "Could not reach the NASA catalogue. No fallback POWER data is returned as IMERG.", checkedAt: new Date().toISOString() }; }
});