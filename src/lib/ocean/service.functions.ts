// Browser-only prepared asset facade: no upstream ocean service or credential.
import { preparedHistory, preparedImage, preparedMetadata, preparedPoint } from "./archive";
import type { OceanCode, OceanTarget } from "./data";
const failure = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Prepared NASA data unavailable." });
export async function fetchOceanMetadata() { try { return { ok: true as const, ...await preparedMetadata() }; } catch (e) { return failure(e); } }
export async function fetchOceanImage({ data }: { data: { code: OceanCode; month: string } }) { try { return { ok: true as const, layer: await preparedImage(data.code, data.month) }; } catch (e) { return failure(e); } }
export async function fetchOceanHistory({ data }: { data: { target: OceanTarget; start: number; end: number } }) { try { return { ok: true as const, records: await preparedHistory(data.target, data.start, data.end) }; } catch (e) { return failure(e); } }
export async function fetchOceanPoint(code: OceanCode, month: string, lat: number, lon: number) { try { return { ok: true as const, records: [await preparedPoint(code, month, lat, lon)] }; } catch (e) { return failure(e); } }