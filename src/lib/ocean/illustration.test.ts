import { describe, expect, it } from "vitest";
import { FISH_ILLUSTRATION } from "./illustration";
describe("Separate artificial Fisheries illustration", () => {
  it("identifies schematic symbols as neither observations nor predictions", () => {
    expect(FISH_ILLUSTRATION.dataRole).toBe("artificial_illustration");
    expect(FISH_ILLUSTRATION.isPrediction).toBe(false);
    expect(FISH_ILLUSTRATION.isObservedFishData).toBe(false);
    expect(FISH_ILLUSTRATION.environmentalContextMonth).toBe("2024-01");
    expect(FISH_ILLUSTRATION.positions).toHaveLength(5);
  });
});