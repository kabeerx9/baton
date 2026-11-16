import { describe, expect, it } from "vite-plus/test";
import { easeRect, placeCard } from "./rect";

describe("easeRect", () => {
  it("snaps once within half a pixel", () => {
    const to = { top: 10, left: 10, width: 100, height: 40 };
    expect(easeRect({ ...to, top: 10.3 }, to)).toEqual(to);
  });
});

describe("placeCard", () => {
  const viewport = { width: 1280, height: 800 };
  const card = { width: 340, height: 220 };

  it("sits below a target that has room", () => {
    const placed = placeCard(
      { top: 100, left: 400, width: 200, height: 100 },
      card,
      viewport,
    );
    expect(placed.top).toBe(214);
  });

  it("goes above when there is no room below", () => {
    const placed = placeCard(
      { top: 600, left: 400, width: 200, height: 100 },
      card,
      viewport,
    );
    expect(placed.top).toBe(600 - 14 - 220);
  });

  it("centers without a target", () => {
    const placed = placeCard(null, card, viewport);
    expect(placed.left).toBe((1280 - 340) / 2);
  });
});
