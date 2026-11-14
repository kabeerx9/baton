import { describe, expect, it } from "vite-plus/test";
import { type CardSpot, focusFallback } from "./focus-fallback";

const columns = ["todo", "doing", "review", "done"];
const spot = (key: string, column: string, index: number): CardSpot => ({
  key,
  column,
  index,
});

describe("focusFallback", () => {
  it("takes the card now at the same place in the column", () => {
    const spots = [spot("a", "doing", 0), spot("b", "doing", 1)];
    expect(focusFallback({ column: "doing", index: 1 }, spots, columns)).toBe(
      "b",
    );
  });

  it("takes the card at the same index, not the last one", () => {
    const spots = [
      spot("a", "doing", 0),
      spot("b", "doing", 1),
      spot("c", "doing", 2),
    ];
    expect(focusFallback({ column: "doing", index: 1 }, spots, columns)).toBe(
      "b",
    );
  });

  it("takes the last card when the column got shorter", () => {
    const spots = [spot("a", "doing", 0), spot("b", "doing", 1)];
    expect(focusFallback({ column: "doing", index: 5 }, spots, columns)).toBe(
      "b",
    );
  });

  it("does not depend on the order of the spots", () => {
    const spots = [spot("b", "doing", 1), spot("a", "doing", 0)];
    expect(focusFallback({ column: "doing", index: 9 }, spots, columns)).toBe(
      "b",
    );
  });

  it("goes to the first card of the nearest column on the right first", () => {
    const spots = [
      spot("l", "todo", 0),
      spot("r1", "review", 0),
      spot("r2", "review", 1),
      spot("far", "done", 0),
    ];
    expect(focusFallback({ column: "doing", index: 0 }, spots, columns)).toBe(
      "r1",
    );
  });

  it("skips empty columns on the right", () => {
    const spots = [spot("l", "todo", 0), spot("far", "done", 0)];
    expect(focusFallback({ column: "doing", index: 0 }, spots, columns)).toBe(
      "far",
    );
  });

  it("goes left when nothing is on the right, nearest first", () => {
    const spots = [spot("t", "todo", 0), spot("d", "doing", 0)];
    expect(focusFallback({ column: "review", index: 0 }, spots, columns)).toBe(
      "d",
    );
  });

  it("returns null for an empty board", () => {
    expect(
      focusFallback({ column: "doing", index: 0 }, [], columns),
    ).toBeNull();
  });

  it("returns null for an unknown column with no cards in it", () => {
    expect(
      focusFallback(
        { column: "gone", index: 0 },
        [spot("a", "todo", 0)],
        columns,
      ),
    ).toBeNull();
  });
});
