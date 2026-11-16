import { describe, expect, it } from "vite-plus/test";
import { makeShards } from "./shard-geometry";

function area([a, b, c]: [number, number][]) {
  return (
    Math.abs(
      (b![0] - a![0]) * (c![1] - a![1]) - (c![0] - a![0]) * (b![1] - a![1]),
    ) / 2
  );
}

describe("makeShards", () => {
  it("covers the whole screen with no overlap", () => {
    const total = makeShards().reduce((sum, s) => sum + area(s.points), 0);
    expect(total).toBeCloseTo(100 * 100, 4);
  });

  it("is the same layout for the same seed", () => {
    expect(makeShards(4, 3, 1)).toEqual(makeShards(4, 3, 1));
  });
});
