import { parseRates } from "./short-interval";
self.onmessage = async (e: MessageEvent<{ id: number; file: File; interval: 1 | 30 }>) => {
  const { id, file, interval } = e.data;
  try {
    if (file.size > 20000000) throw new Error("Maximum 20 MB per local rainfall file.");
    const raw = await file.arrayBuffer(), hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", raw))].map(v => v.toString(16).padStart(2, "0")).join("");
    postMessage({ id, sample: { rows: parseRates(new TextDecoder().decode(raw), interval), interval, filename: file.name, hash } });
  } catch (e) { postMessage({ id, error: e instanceof Error ? e.message : "Import failed" }); }
};