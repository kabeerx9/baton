import { describe, expect, it } from "vite-plus/test";
import { COLUMNS, columnOrder } from "./column-order";
import { boardTaskFixture } from "./test-fixtures";

const today = new Date("2026-11-14T00:00:00").getTime();
const day = 86_400_000;

describe("columnOrder", () => {
  it("returns every column in board order, empty ones included", () => {
    const result = columnOrder([], today, 0);
    expect(result.map((c) => c.status)).toEqual(COLUMNS);
    expect(
      result.every((c) => c.items.length === 0 && c.olderCount === 0),
    ).toBe(true);
  });

  it("puts each task in its column", () => {
    const result = columnOrder(
      [
        boardTaskFixture("a", { column: "doing" }),
        boardTaskFixture("b", { column: "todo" }),
      ],
      today,
      0,
    );
    expect(result.map((c) => c.items.map((t) => t.id))).toEqual([
      ["b"],
      ["a"],
      [],
      [],
    ]);
  });

  it("orders cards: overdue, then priority, then due date, then key", () => {
    const result = columnOrder(
      [
        boardTaskFixture("t-3", { priority: "low" }),
        boardTaskFixture("t-2", { priority: "urgent" }),
        boardTaskFixture("t-1", {
          priority: "low",
          dueDate: new Date(today - day).toISOString(),
        }),
      ],
      today,
      0,
    );
    expect(result[0].items.map((t) => t.id)).toEqual(["t-1", "t-2", "t-3"]);
  });

  it("shows every card the server sent and the server's count of older ones", () => {
    const result = columnOrder(
      [
        boardTaskFixture("new", {
          column: "done",
          finishedAt: new Date(today - day).toISOString(),
        }),
        boardTaskFixture("undated", { column: "done", finishedAt: null }),
      ],
      today,
      7,
    );
    const done = result[3];
    expect(done.items.map((t) => t.id).sort()).toEqual(["new", "undated"]);
    expect(done.olderCount).toBe(7);
  });

  it("keeps the older count out of the other columns", () => {
    const result = columnOrder(
      [
        boardTaskFixture("a", {
          column: "review",
          finishedAt: new Date(today - 40 * day).toISOString(),
        }),
      ],
      today,
      7,
    );
    expect(result[2].items).toHaveLength(1);
    expect(result[2].olderCount).toBe(0);
  });
});
