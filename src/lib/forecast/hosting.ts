export const WAKING_MESSAGE = "Forecast service is waking up (free hosting, up to about a minute). Press Retry; no result is shown until the real service responds.";
export const RESTARTED_MESSAGE = "The forecast service restarted on free hosting and this job was lost. Submit the forecast again.";
/** Map an upstream status from the free-hosted service to an honest message, or null to use the default. */
export function hostingMessage(action: "check" | "submit" | "poll" | "cancel", status: number | "timeout"): string | null {
  if (status === "timeout" || status === 502 || status === 503 || status === 504) return action === "poll" ? RESTARTED_MESSAGE : WAKING_MESSAGE;
  if (status === 404 && (action === "poll" || action === "cancel")) return RESTARTED_MESSAGE;
  return null;
}
