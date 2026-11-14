// Synthetic two-by-two files test storage state only, not scientific data.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ fail: "" as string, saved: undefined as unknown, messages: [] as { type: string; data: any }[] }));
vi.mock("./local", () => ({ LOCAL_INPUTS: { rain: { name: "rain.txt", hash: "00", rows: 2, cols: 2, maxBytes: 100 }, height: { name: "height.txt", hash: "00", rows: 2, cols: 2, maxBytes: 100 } }, evaluate: () => ({ valid: true }), pointCurve: () => [], filledBands: () => [], provenance: () => ({}), validateMap: () => ({}) }));
async function action(action: string, extra: object = {}) {
  state.messages = [];
  await (self.onmessage as unknown as (e: { data: object }) => Promise<void>)({ data: { id: 1, action, ...extra } });
  return state.messages.at(-1);
}
const file = { size: 8, arrayBuffer: async () => new TextEncoder().encode("1 1\n2 2").buffer };
beforeEach(async () => {
  vi.resetModules(); state.fail = ""; state.saved = undefined; state.messages = [];
  vi.stubGlobal("postMessage", (m: any) => state.messages.push(m));
  vi.stubGlobal("crypto", { subtle: { digest: async () => new Uint8Array([0]).buffer } });
  vi.stubGlobal("indexedDB", { open: () => {
    const request: any = {};
    queueMicrotask(() => {
      if (state.fail === "open") { request.onerror(); return; }
      request.result = { close() {}, transaction: () => {
        const tx: any = {};
        tx.objectStore = () => ({ get: () => run("read"), put: (value: unknown) => run("write", value), clear: () => run("clear") });
        function run(kind: string, value?: unknown) { const req = { result: kind === "read" ? state.saved : undefined }; queueMicrotask(() => { if (state.fail === kind) { tx.onabort(); return; } if (kind === "write") state.saved = value; if (kind === "clear") state.saved = undefined; tx.oncomplete(); }); return req; }
        return tx;
      } }; request.onsuccess();
    }); return request;
  } });
  await import("./local.worker");
});
afterEach(() => vi.unstubAllGlobals());
async function loadBoth() { await action("load", { kind: "rain", file }); await action("load", { kind: "height", file }); }
describe("storage failures never mislabel worker memory", () => {
  it("notifies removal before failed deletion and reports saved storage may remain", async () => {
    await loadBoth(); await action("remember", { remember: true }); state.fail = "clear";
    await action("remove");
    expect(state.messages[0]).toMatchObject({ type: "removed", data: { pending: true, storageCleared: false } });
    expect(state.messages.at(-1)).toMatchObject({ type: "removed", data: { storageCleared: false, pending: false } });
    expect(state.messages.at(-1)?.data.warning).toContain("may remain");
    const p = await action("point", { scenario: {}, lat: 2, lon: 102 });
    expect(p?.type).toBe("error");
  });
  it("failed remember write turns remember off and retains usable session grids", async () => {
    await loadBoth(); state.fail = "write";
    expect(await action("remember", { remember: true })).toMatchObject({ type: "remembered", data: { remembered: false } });
    expect(await action("point", { scenario: {}, lat: 2, lon: 102 })).toMatchObject({ type: "point", data: { point: { valid: true } } });
  });
  it.each(["open", "read", "corrupt"])("%s restore offers clean session-only loading", async failure => {
    if (failure === "corrupt") state.saved = { rain: file }; else state.fail = failure;
    expect(await action("restore")).toMatchObject({ type: "ready", data: { rain: false, height: false, remembered: false } });
    expect(state.messages.at(-1)?.data.warning).toContain("session-only loading");
    await loadBoth();
    expect(state.messages.at(-1)).toMatchObject({ type: "ready", data: { rain: true, height: true, remembered: false } });
  });
});