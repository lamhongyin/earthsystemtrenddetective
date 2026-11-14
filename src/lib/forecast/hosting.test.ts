import { describe, expect, it } from "vitest";
import { hostingMessage, RESTARTED_MESSAGE, WAKING_MESSAGE } from "./hosting";
describe("free hosting messages", () => {
  it("health timeout reports waking", () => expect(hostingMessage("check", "timeout")).toBe(WAKING_MESSAGE));
  it("lost job during polling reports restart", () => expect(hostingMessage("poll", 404)).toBe(RESTARTED_MESSAGE));
  it("validation errors keep upstream detail", () => expect(hostingMessage("submit", 422)).toBeNull());
});
