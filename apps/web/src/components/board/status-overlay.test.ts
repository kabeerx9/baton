import { describe, expect, it } from "vite-plus/test";
import type { BoardResponse } from "@/fetchers/board/get-board";
import type { Entry } from "@/store/task-status/types";
import { overlayBoardItems, statusFactsOf } from "./status-overlay";

type Item = BoardResponse["tasks"][number];

const NOW = "2026-11-17T10:00:00.000Z";

const sub = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    status: "to-do",
    isCompleted: false,
    finishedAt: null,
    statusGeneration: 3,
    statusChange: { move: "apply" },
    ...over,
  }) as never;

const item = (id: string, subtasks: unknown[] = [], over = {}) =>
  ({
    id,
    status: "to-do",
    isCompleted: false,
    finishedAt: null,
    statusGeneration: 3,
    statusChange: { move: "apply" },
    column: "todo",
    subtasks,
    ...over,
  }) as never as Item;

const sending = (status: string, isFinal = false): Entry => ({
  kind: "sending",
  inFlight: { status, isFinal },
  latest: { status, isFinal },
});

describe("overlayBoardItems", () => {
  it("returns the same list when nothing is in flight", () => {
    const tasks = [item("a")];
    expect(overlayBoardItems(tasks, {}, NOW)).toBe(tasks);
  });

  it("moves a plain card to its new column and completes it with a final target", () => {
    const [moved] = overlayBoardItems(
      [item("a")],
      { a: sending("done", true) },
      NOW,
    );
    expect(moved).toMatchObject({
      status: "done",
      isCompleted: true,
      column: "done",
      finishedAt: NOW,
    });
  });

  it("moves a plain card between open columns without completing it", () => {
    const [moved] = overlayBoardItems(
      [item("a")],
      { a: sending("in-progress") },
      NOW,
    );
    expect(moved).toMatchObject({
      status: "in-progress",
      isCompleted: false,
      column: "doing",
      finishedAt: null,
    });
  });

  it("changes a task under a feature but leaves the feature's column for the refetch", () => {
    const feature = item("f", [sub("s1"), sub("s2")], { column: "todo" });
    const [moved] = overlayBoardItems(
      [feature],
      { s1: sending("done", true), s2: sending("done", true) },
      NOW,
    );
    expect(moved!.column).toBe("todo");
    expect(moved!.subtasks.map((s) => s.status)).toEqual(["done", "done"]);
    expect(moved!.subtasks.every((s) => s.isCompleted)).toBe(true);
  });

  it("never adds or removes an item", () => {
    const tasks = [item("a"), item("f", [sub("s1")])];
    const moved = overlayBoardItems(tasks, { a: sending("done", true) }, NOW);
    expect(moved.map((t) => t.id)).toEqual(["a", "f"]);
    expect(moved[1]!.subtasks.map((s) => s.id)).toEqual(["s1"]);
  });

  it("goes back to the server value once the entry is gone", () => {
    const tasks = [item("a")];
    expect(overlayBoardItems(tasks, {}, NOW)[0]!.column).toBe("todo");
  });

  it("shows a confirmed target until the read reaches its generation", () => {
    const confirmed: Entry = {
      kind: "confirmed",
      target: { status: "done", isFinal: true },
      generation: 4,
    };
    const stale = overlayBoardItems([item("a")], { a: confirmed }, NOW)[0]!;
    expect(stale.column).toBe("done");
    const fresh = overlayBoardItems(
      [item("a", [], { statusGeneration: 4 })],
      { a: confirmed },
      NOW,
    )[0]!;
    expect(fresh.column).toBe("todo");
  });
});

describe("statusFactsOf", () => {
  const board = {
    tasks: [item("f", [sub("s1", { statusChange: { move: "deny" } })])],
  } as never as BoardResponse;

  it("finds a task and a task under a feature", () => {
    expect(statusFactsOf(board, "f").statusChange).toEqual({ move: "apply" });
    expect(statusFactsOf(board, "s1").statusChange).toEqual({ move: "deny" });
  });

  it("gives nothing for a task the board does not list", () => {
    expect(statusFactsOf(board, "gone")).toEqual({});
    expect(statusFactsOf(undefined, "f")).toEqual({});
  });
});
