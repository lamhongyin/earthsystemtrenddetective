import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { manifestSchema, preparedHistory, preparedPoint, defaultMonth, verifyAsset } from "./archive";
import { seasonalTrend } from "./data";

const installed = manifestSchema.parse(JSON.parse(readFileSync("public/fisheries/manifest.json", "utf8")));
const source = installed.sources.chlorophyll;
const nativeFetch = globalThis.fetch;
afterEach(() => vi.unstubAllGlobals());
function useInstalledArchive() {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", (url: string) => nativeFetch(`http://localhost:8080${url}`));
}
describe("Installed NASA January 2024 chlorophyll sample", () => {
  it("installs only the documented month, processing version and units alongside genuine SST", () => {
    expect(source?.metadata.times).toEqual(["2024-01"]);
    expect(source?.metadata.version).toBe("R2022.0.3");
    expect(source?.metadata.unit).toBe("mg/m³");
    expect(source?.metadata.resolution).toBe(1 / 12);
    expect(installed.sources.sst?.metadata.version).toBe("R2019.0");
    expect(installed.sources.sst?.metadata.times).toEqual(["2024-01"]);
    expect(defaultMonth([source?.metadata].filter(m => m !== undefined), "chlorophyll", "2026-11-14")).toBe("2024-01");
  });
  it("retains genuine SST native points, original bounds and quality provenance", async () => {
    useInstalledArchive();
    const sst = installed.sources.sst;
    expect(sst?.metadata.unit).toBe("°C");
    expect(sst?.provenance.inputSha256).toBe("d8d49bf5c558fd74e0c7fafd13cae3fb87474f10735ba481624c0e81ffb58832");
    expect(sst?.provenance.sourceTimeCoverageStart).toBe("2024-01-01T00:10:01.000Z");
    for (const [lat,lon,value] of [[1.8,104.5,28.244998931884766],[5.05,110.05,27.69999885559082],[2.8,101,29.78999900817871]]) {
      if (lat === undefined || lon === undefined) throw new Error("Invalid point");
      const records = await preparedHistory({lat,lon},2024,2024);
      expect(records.find(r => r.code === "sst")?.months[0]?.value).toBe(value);
    }
    if (!sst) throw new Error("Missing SST");
    for (const spec of [...Object.values(sst.maps),sst.histories]) await expect(verifyAsset(await (await fetch(spec.path)).arrayBuffer(),spec)).resolves.toBeUndefined();
  });
  it("serves unchanged map and history bytes matching supplied SHA-256 entries", async () => {
    useInstalledArchive();
    if (!source) throw new Error("Missing installed sample");
    for (const spec of [...Object.values(source.maps), source.histories]) {
      const response = await fetch(spec.path);
      expect(response.ok).toBe(true);
      await expect(verifyAsset(await response.arrayBuffer(), spec)).resolves.toBeUndefined();
    }
  });
  it("retains native Johor, South China Sea and Malacca point measurements", async () => {
    useInstalledArchive();
    for (const [lat, lon, value] of [[1.8,104.5,4.153026580810547], [5.05,110.05,0.14583836495876312], [2.8,101,3.6388227939605713]]) {
      if (lat === undefined || lon === undefined || value === undefined) throw new Error("Invalid fixture");
      const records = await preparedHistory({lat, lon}, 2005, 2024);
      expect(records.map(r => r.code)).toEqual(["sst", "chlorophyll"]);
      expect(records.find(r => r.code === "chlorophyll")?.months[0]?.value).toBe(value);
      expect(seasonalTrend(records.find(r => r.code === "chlorophyll")?.months ?? [],2005,2024).slope).toBeNull();
    }
  });
  it("preserves region area weighting and rejects below-70-percent coverage", async () => {
    useInstalledArchive();
    const regions = [
      { lat:1.75,lon:104.5,bounds:{south:1.7,north:1.8,west:104.45,east:104.55}, value:3.4824445956947905 },
      { lat:2.8,lon:101,bounds:{south:2.75,north:2.85,west:100.95,east:101.05}, value:3.4970574071611185 },
      { lat:5.05,lon:110.05,bounds:{south:5,north:5.1,west:110,east:110.1}, value:null },
    ];
    for (const {value,...target} of regions) {
      const records = await preparedHistory(target,2024,2024);
      expect(records.find(r => r.code === "chlorophyll")?.months[0]?.value).toBe(value);
      expect(records.find(r => r.code === "chlorophyll")?.cell).toBeNull();
      if (value === null) expect(records.find(r => r.code === "chlorophyll")?.months[0]?.coverage).toBe(0.6945004091336706);
    }
  });
  it("keeps overview measurements distinct from native histories and does not invent arbitrary histories", async () => {
    useInstalledArchive();
    const overview = await preparedPoint("chlorophyll","2024-01",1.8,104.5);
    expect(overview.cell).toMatchObject({lat:1.5,lon:104.5});
    expect(overview.months[0]?.value).toBe(2.539729);
    expect(overview.maskMethod).toContain("1°");
    await expect(preparedHistory({lat:0,lon:0},2024,2024)).rejects.toThrow("not included");
  });
});