import { describe, expect, it } from "vite-plus/test";
import { bonePhase } from "./bone-phase";

describe("bonePhase", () => {
  it("maps each view", () => {
    expect(bonePhase({ kind: "quiet" })).toBe("bones");
    expect(bonePhase({ kind: "loading", step: 0, reassure: false })).toBe(
      "bones",
    );
    expect(bonePhase({ kind: "handoff", wasShown: true })).toBe("handoff");
    expect(bonePhase({ kind: "handoff", wasShown: false })).toBe("reveal");
    expect(bonePhase({ kind: "done" })).toBe("content");
  });
});
