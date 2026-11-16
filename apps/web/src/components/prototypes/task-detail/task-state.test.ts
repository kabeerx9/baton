import { describe, expect, it } from "vite-plus/test";
import { DATA_SETS } from "./mock-data";
import { KABEER, SAM } from "./people";
import { initialState, taskReducer } from "./task-state";
import type { Viewer } from "./types";

const me: Viewer = { person: KABEER, involved: true };
const member: Viewer = { person: SAM, involved: false };

describe("taskReducer", () => {
  it("refuses to finish a task that waits on an open task", () => {
    const s = initialState({ ...DATA_SETS.a.task, status: "review" });
    const out = taskReducer(s, { type: "set-status", to: "done", viewer: me });
    expect(out.task.status).toBe("review");
    expect(out.outcome.kind).toBe("refused");
  });

  it("lets a blocked task start", () => {
    const out = taskReducer(initialState(DATA_SETS.a.task), {
      type: "set-status",
      to: "doing",
      viewer: me,
    });
    expect(out.task.status).toBe("doing");
    expect(out.task.activity[0]?.kind).toBe("status");
  });

  it("turns a status change by a member into a request", () => {
    const out = taskReducer(initialState(DATA_SETS.a.task), {
      type: "set-status",
      to: "doing",
      viewer: member,
    });
    expect(out.task.status).toBe("todo");
    expect(out.task.request?.requester.id).toBe(SAM.id);
  });

  it("refuses assignment by a member", () => {
    const out = taskReducer(initialState(DATA_SETS.a.task), {
      type: "assign",
      person: SAM,
      viewer: member,
    });
    expect(out.task.assignee).toBeNull();
    expect(out.outcome.kind).toBe("refused");
  });

  it("cancels an accepted request when the task is still blocked", () => {
    const out = taskReducer(initialState(DATA_SETS.busy.task), {
      type: "answer",
      accept: true,
      viewer: me,
    });
    expect(out.task.status).toBe("review");
    expect(out.task.request).toBeNull();
    expect(out.outcome.kind).toBe("refused");
  });

  it("applies an accepted request once nothing blocks it", () => {
    const freed = taskReducer(initialState(DATA_SETS.busy.task), {
      type: "blocker-finished",
      key: "INF-6",
    });
    const out = taskReducer(freed, {
      type: "answer",
      accept: true,
      viewer: me,
    });
    expect(out.task.status).toBe("done");
  });

  it("does not let a requester answer their own request", () => {
    const out = taskReducer(initialState(DATA_SETS.busy.task), {
      type: "answer",
      accept: true,
      viewer: { person: SAM, involved: true },
    });
    expect(out.task.request).not.toBeNull();
    expect(out.outcome.kind).toBe("refused");
  });
});
