import { describe, expect, it } from "vite-plus/test";
import type { BoardResponse } from "@/fetchers/board/get-board";
import { withItem } from "./merge-item";

const board = (ids: string[]) =>
  ({
    tasks: ids.map((id) => ({ id })),
    members: [],
    projects: [],
  }) as never as BoardResponse;
const item = (id: string) =>
  ({ id }) as never as BoardResponse["tasks"][number];

describe("withItem", () => {
  it("adds an item the window left out", () => {
    const merged = withItem(board(["a"]), item("old"));
    expect(merged.tasks.map((t) => t.id)).toEqual(["a", "old"]);
  });

  it("keeps the board as it is when it already has the item", () => {
    const b = board(["a", "old"]);
    expect(withItem(b, item("old"))).toBe(b);
  });

  it("keeps the board as it is when there is no item", () => {
    const b = board(["a"]);
    expect(withItem(b, null)).toBe(b);
    expect(withItem(b, undefined)).toBe(b);
  });
});
