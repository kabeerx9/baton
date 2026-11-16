import { describe, expect, it } from "vite-plus/test";
import { nextPriority } from "./cycle";

describe("nextPriority", () => {
  it("steps up and wraps", () => {
    expect(nextPriority("none")).toBe("low");
    expect(nextPriority("high")).toBe("urgent");
    expect(nextPriority("urgent")).toBe("none");
  });
});
