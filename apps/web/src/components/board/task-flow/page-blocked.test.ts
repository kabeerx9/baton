import { describe, expect, it } from "vite-plus/test";
import { blocker, boardTaskFixture, subtaskFixture } from "../test-fixtures";
import type { LinkedTask } from "./linked";
import {
  dependentState,
  pageBlocked,
  pageDone,
  waitingOnThis,
} from "./page-blocked";

const rel = (status: LinkedTask["status"]): LinkedTask => ({
  id: "x",
  projectId: "p",
  key: "API-1",
  title: "x",
  status,
  owner: null,
});

describe("pageBlocked", () => {
  it("keeps a repo task that is not on the board blocked by its open relation", () => {
    expect(
      pageBlocked({
        status: "todo",
        boardItem: undefined,
        waitsOn: [rel("doing")],
      }),
    ).toBe(true);
  });

  it("is free when its relation blockers are done", () => {
    expect(
      pageBlocked({
        status: "todo",
        boardItem: undefined,
        waitsOn: [rel("done")],
      }),
    ).toBe(false);
  });

  it("uses the API rule for a board item, whatever the relations say", () => {
    const held = subtaskFixture("a", { waitsOn: [blocker("API-1")] });
    expect(pageBlocked({ status: "todo", boardItem: held, waitsOn: [] })).toBe(
      true,
    );
    expect(
      pageBlocked({
        status: "todo",
        boardItem: subtaskFixture("b"),
        waitsOn: [rel("doing")],
      }),
    ).toBe(false);
  });

  it("is never blocked once done", () => {
    expect(
      pageBlocked({
        status: "done",
        boardItem: undefined,
        waitsOn: [rel("todo")],
      }),
    ).toBe(false);
  });
});

describe("waitingOnThis", () => {
  it("reads the target's waitsOn when it is on the board", () => {
    const target = subtaskFixture("t", { waitsOn: [blocker("ME")] });
    expect(waitingOnThis({ target, taskId: "me", fallback: false })).toBe(true);
    expect(waitingOnThis({ target, taskId: "other", fallback: true })).toBe(
      false,
    );
  });

  it("falls back to the relation answer off the board", () => {
    expect(
      waitingOnThis({ target: undefined, taskId: "me", fallback: true }),
    ).toBe(true);
  });
});

describe("a feature's stored status is not its state", () => {
  const openChild = subtaskFixture("c");
  const doneChild = subtaskFixture("d", { status: "done" });

  it("stored done with an open child: open, still blocks dependents", () => {
    const feature = boardTaskFixture("f", {
      status: "done",
      column: "doing",
      waitsOn: [blocker("API-1")],
      subtasks: [openChild],
    });
    expect(pageDone({ status: "done", boardItem: feature })).toBe(false);
    expect(
      pageBlocked({ status: "done", boardItem: feature, waitsOn: [] }),
    ).toBe(true);
    const state = dependentState({
      thisDone: pageDone({ status: "done", boardItem: feature }),
      dependentDone: false,
      waiting: waitingOnThis({
        target: subtaskFixture("dep", { waitsOn: [blocker("F")] }),
        taskId: "f",
        fallback: false,
      }),
    });
    expect(state).toBe("waiting");
  });

  it("stored todo with every child done: done, dependents can continue", () => {
    const feature = boardTaskFixture("f", {
      status: "todo",
      column: "done",
      subtasks: [doneChild],
    });
    expect(pageDone({ status: "todo", boardItem: feature })).toBe(true);
    expect(
      pageBlocked({ status: "todo", boardItem: feature, waitsOn: [] }),
    ).toBe(false);
    expect(
      dependentState({
        thisDone: true,
        dependentDone: false,
        waiting: waitingOnThis({
          target: subtaskFixture("dep"),
          taskId: "f",
          fallback: true,
        }),
      }),
    ).toBe("canContinue");
  });

  it("a plain task still follows its own status", () => {
    const task = boardTaskFixture("t", { status: "doing", column: "doing" });
    expect(pageDone({ status: "doing", boardItem: task })).toBe(false);
    expect(pageDone({ status: "done", boardItem: undefined })).toBe(true);
    expect(
      dependentState({ thisDone: false, dependentDone: false, waiting: true }),
    ).toBe("waiting");
    expect(
      dependentState({ thisDone: false, dependentDone: true, waiting: false }),
    ).toBe("finished");
  });
});
