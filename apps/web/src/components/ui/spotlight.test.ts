import { describe, expect, it } from "vite-plus/test";
import { maskPath } from "./spotlight";

describe("maskPath", () => {
  it("is one path: the viewport plus one hole", () => {
    const d = maskPath(1000, 800, {
      top: 100,
      left: 200,
      width: 300,
      height: 120,
    });
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.startsWith("M0 0H1000V800H0Z")).toBe(true);
  });

  it("dims everything when there is no target", () => {
    expect(maskPath(1000, 800, null)).toBe("M0 0H1000V800H0Z");
  });
});
