import { describe, expect, it } from "vite-plus/test";
import { heroTone } from "./hero-tone";

const none = {
  unknown: false,
  done: false,
  pendingRequest: false,
  blocked: false,
  started: false,
};

describe("heroTone", () => {
  it("is neutral for an unknown status, even when done", () => {
    expect(heroTone({ ...none, unknown: true, done: true })).toBe("neutral");
  });
  it("orders done, request, blocked, started", () => {
    expect(heroTone({ ...none, done: true, blocked: true })).toBe("emerald");
    expect(heroTone({ ...none, pendingRequest: true, blocked: true })).toBe(
      "violet",
    );
    expect(heroTone({ ...none, blocked: true, started: true })).toBe("amber");
    expect(heroTone({ ...none, started: true })).toBe("blue");
    expect(heroTone(none)).toBe("neutral");
  });
});
