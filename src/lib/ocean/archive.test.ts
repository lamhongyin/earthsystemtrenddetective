import { describe, expect, it, vi, afterEach } from "vitest";
import { defaultMonth, manifestSchema, preparedMetadata, verifyAsset } from "./archive";
import { OCEAN_SOURCES, OCEAN_VERSION, type OceanMetadata } from "./data";

const meta = (code: "sst" | "chlorophyll", times: string[]): OceanMetadata => ({ id: OCEAN_SOURCES[code].id, title: code, start: times[0] ?? "", end: times.at(-1) ?? "", times, unit: OCEAN_SOURCES[code].unit, version: code === "sst" ? "R2019.0" : "2022.0", summary: "", latFirst: 89.958, latLast: -89.958, lonFirst: -179.958, lonLast: 179.958, retrievedAt: "2026-11-14T00:00:00Z", resolution: 1 / 12 });
const spec = { path: "/fisheries/test/sst.json", bytes: 3, sha256: "a".repeat(64) };
const source = (code: "sst" | "chlorophyll", times = ["2024-01"]) => ({ metadata: meta(code, times), maps: Object.fromEntries(times.map(t => [t, spec])), histories: spec, provenance: {} });
const manifest = (sources: object) => ({ schema: OCEAN_VERSION, bundle: "test", createdAt: "2026-11-14T00:00:00Z", sources });
afterEach(() => vi.unstubAllGlobals());
describe("Prepared Fisheries archive rules", () => {
  it("allows SST alone with no chlorophyll dependency", () => { expect(manifestSchema.parse(manifest({ sst: source("sst") })).sources.chlorophyll).toBeUndefined(); });
  it("allows chlorophyll alone with no SST dependency", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(manifest({ chlorophyll: source("chlorophyll") })) )));
    expect((await preparedMetadata()).sources.map(s => s.id)).toEqual(["MODISA_L3m_CHL"]);
  });
  it("does not invent dates for an empty archive", () => { expect(defaultMonth([], "sst", "2026-11-14")).toBe(""); });
  it("uses the latest common complete month", () => { expect(defaultMonth([meta("sst", ["2024-01", "2024-03"]), meta("chlorophyll", ["2024-01", "2024-02"])], "sst", "2026-11-14")).toBe("2024-01"); });
  it("falls back to own latest complete month when there is no overlap", () => { expect(defaultMonth([meta("sst", ["2024-03"]), meta("chlorophyll", ["2024-02"])], "chlorophyll", "2026-11-14")).toBe("2024-02"); });
  it("rejects current/incomplete months as defaults", () => { expect(defaultMonth([meta("sst", ["2026-10", "2026-11"])], "sst", "2026-11-14")).toBe("2026-10"); });
  it("rejects dates without dependent map assets", () => { const s = source("sst"); s.maps = {}; expect(() => manifestSchema.parse(manifest({ sst: s }))).toThrow(); });
  it("rejects invalid calendar month", () => { expect(() => manifestSchema.parse(manifest({ sst: source("sst", ["2024-13"]) }))).toThrow(); });
  it("separates the old ERDDAP cache version", () => { expect(() => manifestSchema.parse({ ...manifest({}), schema: "ocean-month-effects-v1" })).toThrow(); });
  it("rejects asset traversal", () => { const s = source("sst"); s.histories = { ...spec, path: "/fisheries/../private.json" }; expect(() => manifestSchema.parse(manifest({ sst: s }))).toThrow(); });
  it("rejects corrupted assets and incorrect sizes", async () => {
    const bytes = new TextEncoder().encode("abc").buffer;
    await expect(verifyAsset(bytes, spec)).rejects.toThrow("integrity");
    const valid = { ...spec, sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" };
    await expect(verifyAsset(bytes, valid)).resolves.toBeUndefined();
    await expect(verifyAsset(bytes, { ...valid, bytes: 4 })).rejects.toThrow("integrity");
  });
});