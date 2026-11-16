import { describe, expect, it } from "vite-plus/test";
import { deriveTaskView } from "./derive";
import { DATA_SETS } from "./mock-data";
import { KABEER, SAM } from "./people";
import type { Viewer } from "./types";

const me: Viewer = { person: KABEER, involved: true };
const member: Viewer = { person: SAM, involved: false };
const A = DATA_SETS.a.task;
const B = DATA_SETS.b.task;
const BUSY = DATA_SETS.busy.task;

describe("deriveTaskView", () => {
  it("treats an unknown stored status as the safe state", () => {
    const view = deriveTaskView({ ...A, status: "archived-v2" }, me);
    expect(view.state.kind).toBe("unknown");
    expect(view.next.kind).toBe("none");
    expect(view.waitingOnMe).toEqual([]);
  });

  it("lets a blocked to-do task start", () => {
    const view = deriveTaskView(A, me);
    expect(view.state.kind).toBe("blocked");
    expect(view.next).toEqual({ kind: "move", to: "doing", direct: true });
  });

  it("does not let a blocked task in progress finish", () => {
    const view = deriveTaskView({ ...A, status: "review" }, me);
    expect(view.next.kind).toBe("wait");
  });

  it("asks instead of moving when the viewer is not involved", () => {
    const view = deriveTaskView(A, member);
    expect(view.next).toEqual({ kind: "move", to: "doing", direct: false });
  });

  it("lists who a finished task released", () => {
    const view = deriveTaskView(B, me);
    expect(view.state).toMatchObject({ kind: "done" });
    if (view.state.kind === "done") {
      expect(view.state.released.map((t) => t.key)).toEqual(["APP-40"]);
    }
  });

  it("puts a pending request ahead of a blocker, and only others answer it", () => {
    const view = deriveTaskView(BUSY, me);
    expect(view.state.kind).toBe("awaiting");
    expect(view.next.kind).toBe("answer");
    expect(
      deriveTaskView(BUSY, { person: SAM, involved: true }).next.kind,
    ).toBe("none");
  });
});
