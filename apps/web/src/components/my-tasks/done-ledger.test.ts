import { describe, expect, it } from "vite-plus/test";
import {
  clearedCount,
  type DoneEvent,
  type DoneLedger,
  doneTransition,
  EMPTY_LEDGER,
  hiddenIds,
  stillOpen,
  undoTarget,
} from "./done-ledger";
import { assigned } from "./test-task";

const a = assigned("a", { status: "in-progress" });
const b = assigned("b");
const run = (...events: DoneEvent[]): DoneLedger =>
  events.reduce(doneTransition, EMPTY_LEDGER);
const kinds = (ledger: DoneLedger) =>
  ledger.map((e) => `${e.task.id}:${e.kind}`);
const open = (...ids: string[]) => new Set(ids);

const startA: DoneEvent = { type: "start", task: a };
const appliedA: DoneEvent = { type: "applied", id: "a", at: 100 };
const goneA: DoneEvent = { type: "synced", openIds: open("b"), updatedAt: 200 };

describe("doneTransition", () => {
  it("hides a task from the press, and remembers the status it had", () => {
    const ledger = run(startA);
    expect(kinds(ledger)).toEqual(["a:finishing"]);
    expect(ledger[0]?.from).toBe("in-progress");
    expect(hiddenIds(ledger)).toEqual(open("a"));
    expect(undoTarget(ledger)).toBeNull();
    expect(clearedCount(ledger)).toBe(0);
  });

  it("starts a task once", () => {
    const ledger = run(startA);
    expect(doneTransition(ledger, startA)).toBe(ledger);
  });

  it("opens the undo window when the write is applied", () => {
    const ledger = run(startA, appliedA);
    expect(kinds(ledger)).toEqual(["a:applied"]);
    expect(hiddenIds(ledger)).toEqual(open("a"));
    expect(undoTarget(ledger)?.task.id).toBe("a");
    expect(clearedCount(ledger)).toBe(1);
  });

  it("shows the task again when the write became a request", () => {
    const ledger = run(startA, { type: "requested", id: "a" });
    expect(ledger).toEqual([]);
    expect(hiddenIds(ledger)).toEqual(open());
  });

  it("shows the task again when the write failed", () => {
    expect(run(startA, { type: "failed", id: "a" })).toEqual([]);
  });

  it("keeps waiting when the list is older than the write", () => {
    const ledger = run(startA, appliedA);
    const stale: DoneEvent = {
      type: "synced",
      openIds: open("a"),
      updatedAt: 99,
    };
    expect(doneTransition(ledger, stale)).toBe(ledger);
  });

  it("finishes the entry when a newer list no longer holds the task", () => {
    const ledger = run(startA, appliedA, goneA);
    expect(kinds(ledger)).toEqual(["a:finished"]);
    // The list agrees now, so nothing is hidden: a reopened task would show.
    expect(hiddenIds(ledger)).toEqual(open());
    expect(undoTarget(ledger)?.task.id).toBe("a");
  });

  it("drops the entry when a newer list still holds the task", () => {
    const ledger = run(startA, appliedA);
    expect(stillOpen(ledger, open("a"), 200).map((t) => t.id)).toEqual(["a"]);
    expect(stillOpen(ledger, open("a"), 99)).toEqual([]);
    const next = doneTransition(ledger, {
      type: "synced",
      openIds: open("a"),
      updatedAt: 200,
    });
    expect(next).toEqual([]);
    expect(clearedCount(next)).toBe(0);
  });

  it("undoes from applied or finished, and forgets the task when done", () => {
    for (const before of [
      run(startA, appliedA),
      run(startA, appliedA, goneA),
    ]) {
      const undoing = doneTransition(before, { type: "undo", id: "a" });
      expect(kinds(undoing)).toEqual(["a:undoing"]);
      expect(undoTarget(undoing)).toBeNull();
      expect(clearedCount(undoing)).toBe(0);
      expect(doneTransition(undoing, { type: "undone", id: "a" })).toEqual([]);
    }
  });

  it("keeps the task done when the undo write fails", () => {
    const ledger = run(
      startA,
      appliedA,
      { type: "undo", id: "a" },
      { type: "undoFailed", id: "a" },
    );
    expect(kinds(ledger)).toEqual(["a:finished"]);
    expect(undoTarget(ledger)?.from).toBe("in-progress");
  });

  it("offers the newest finish to undo first", () => {
    const ledger = run(
      startA,
      appliedA,
      { type: "start", task: b },
      {
        type: "applied",
        id: "b",
        at: 150,
      },
    );
    expect(undoTarget(ledger)?.task.id).toBe("b");
    const afterUndo = run(
      startA,
      appliedA,
      { type: "start", task: b },
      { type: "applied", id: "b", at: 150 },
      { type: "undo", id: "b" },
      { type: "undone", id: "b" },
    );
    expect(undoTarget(afterUndo)?.task.id).toBe("a");
  });

  it("ignores an event that does not fit the state", () => {
    const finishing = run(startA);
    expect(doneTransition(finishing, { type: "undo", id: "a" })).toBe(
      finishing,
    );
    expect(doneTransition(finishing, { type: "undone", id: "a" })).toBe(
      finishing,
    );
    const applied = run(startA, appliedA);
    expect(doneTransition(applied, { type: "failed", id: "a" })).toBe(applied);
    expect(doneTransition(applied, { type: "requested", id: "a" })).toBe(
      applied,
    );
    expect(doneTransition(applied, appliedA)).toBe(applied);
    expect(doneTransition(applied, { type: "applied", id: "zzz", at: 1 })).toBe(
      applied,
    );
    expect(doneTransition(applied, { type: "nope" } as never)).toBe(applied);
  });
});
