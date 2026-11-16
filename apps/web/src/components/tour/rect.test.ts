import { describe, expect, it } from "vite-plus/test";
import { easeRect } from "./rect";

describe("easeRect", () => {
  it("snaps once within half a pixel", () => {
    const to = { top: 10, left: 10, width: 100, height: 40 };
    expect(easeRect({ ...to, top: 10.3 }, to)).toEqual(to);
  });
});
