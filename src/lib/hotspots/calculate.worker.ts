import { calculateHotspots, type AnnualData, type Settings } from "./calculations";
self.onmessage = (event: MessageEvent<{ data: AnnualData; settings: Settings; id: number }>) => {
  const { data, settings, id } = event.data;
  try { const result = calculateHotspots(data, settings, progress => self.postMessage({ id, progress })); self.postMessage({ id, result }); }
  catch (e) { self.postMessage({ id, error: e instanceof Error ? e.message : "Candidate calculation failed." }); }
};