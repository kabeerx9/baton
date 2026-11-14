import { describe, expect, it } from "vite-plus/test";
import { boundsOf, initialViewport, MIN_START_ZOOM } from "./initial-viewport";

const canvas = { width: 1000, height: 400 };

describe("initialViewport", () => {
  it("never starts below the minimum zoom, however wide the graph is", () => {
    const view = initialViewport(
      { x: 0, y: 0, width: 5000, height: 200 },
      canvas,
    );
    expect(view.zoom).toBe(MIN_START_ZOOM);
  });

  it("puts the left edge at the canvas edge when the graph is wider", () => {
    const view = initialViewport(
      { x: 10, y: 0, width: 5000, height: 200 },
      canvas,
    );
    expect(view.x).toBeCloseTo(24 - 10 * MIN_START_ZOOM);
  });

  it("centres a graph that fits and does not zoom in past 1", () => {
    const view = initialViewport(
      { x: 0, y: 0, width: 400, height: 100 },
      canvas,
    );
    expect(view.zoom).toBe(1);
    expect(view.x).toBeCloseTo(300);
    expect(view.y).toBeCloseTo(150);
  });

  it("zooms out to fit when that stays above the minimum", () => {
    const view = initialViewport(
      { x: 0, y: 0, width: 1100, height: 200 },
      canvas,
    );
    expect(view.zoom).toBeGreaterThanOrEqual(MIN_START_ZOOM);
    expect(view.zoom).toBeLessThan(1);
  });
});

describe("boundsOf", () => {
  it("covers every node with its size", () => {
    const placed = new Map([
      ["a", { x: 0, y: 10 }],
      ["b", { x: 200, y: 50 }],
    ]);
    const sizes = new Map([
      ["a", { width: 100, height: 40 }],
      ["b", { width: 100, height: 40 }],
    ]);
    expect(boundsOf(placed, sizes)).toEqual({
      x: 0,
      y: 10,
      width: 300,
      height: 80,
    });
  });
});
