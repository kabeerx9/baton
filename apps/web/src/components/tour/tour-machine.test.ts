import { describe, expect, it } from "vite-plus/test";
import {
  INITIAL_TOUR_STATE,
  type TourEvent,
  type TourSession,
  type TourState,
  tourReducer,
} from "./tour-machine";
import { STEP_IDS } from "./tour-steps";
import { TASK_IDS } from "./test-fixtures";

const session: TourSession = {
  demoWorkspaceId: "demo",
  taskIds: TASK_IDS,
  originWorkspaceId: "real",
};

const run = (events: TourEvent[], from: TourState = INITIAL_TOUR_STATE) =>
  events.reduce(tourReducer, from);

const ready = (overrides = {}) =>
  ({
    type: "DATA",
    snapshot: {
      status: "ready",
      missing: false,
      apiEndpointDone: false,
      writeTestsUnblocked: false,
      ...overrides,
    },
  }) as const;

const atStep = (step: (typeof STEP_IDS)[number]): TourState => ({
  status: "active",
  step,
  session,
});

describe("tourReducer", () => {
  it("starts at the first step", () => {
    expect(run([{ type: "START" }, { type: "STARTED", session }])).toEqual(
      atStep("welcome"),
    );
  });

  it("resumes at a saved step, and falls back to the first on an unknown one", () => {
    expect(
      run([{ type: "START" }, { type: "STARTED", session, step: "nav-board" }]),
    ).toEqual(atStep("nav-board"));
    expect(
      run([
        { type: "START" },
        { type: "STARTED", session, step: "toString" as never },
      ]),
    ).toEqual(atStep("welcome"));
  });

  it("walks the steps with Next, but never past a data step", () => {
    let state = atStep("nav-board");
    state = run([{ type: "NEXT" }], state);
    expect(state).toEqual(atStep("move-task"));
    expect(run([{ type: "NEXT" }], state)).toBe(state);
  });

  it("goes Back, skipping the interactive step", () => {
    expect(run([{ type: "BACK" }], atStep("unblocked"))).toEqual(
      atStep("nav-board"),
    );
    expect(run([{ type: "BACK" }], atStep("welcome")).status).toBe("active");
    const waiting = atStep("move-task");
    expect(run([{ type: "BACK" }], waiting)).toBe(waiting);
  });

  it("advances the interactive step on data only", () => {
    const state = atStep("move-task");
    expect(run([ready()], state)).toBe(state);
    expect(run([ready({ apiEndpointDone: true })], state)).toEqual(
      atStep("unblocked"),
    );
    // Data for other steps does not move them.
    const board = atStep("welcome");
    expect(run([ready({ apiEndpointDone: true })], board)).toBe(board);
  });

  it("closes quietly when a demo task or the workspace is gone", () => {
    expect(run([ready({ missing: true })], atStep("my-tasks-intro"))).toEqual({
      status: "closed",
      reason: "demo-missing",
    });
    expect(
      run([{ type: "DATA", snapshot: { status: "gone" } }], atStep("mcp")),
    ).toEqual({ status: "closed", reason: "demo-missing" });
  });

  it("asks before skipping, and Cancel returns to the same step", () => {
    const state = run([{ type: "SKIP_ASK" }], atStep("my-tasks-intro"));
    expect(state.status).toBe("confirming-skip");
    expect(run([{ type: "SKIP_CANCEL" }], state)).toEqual(
      atStep("my-tasks-intro"),
    );
    expect(run([{ type: "SKIP_CONFIRM" }], state)).toMatchObject({
      status: "finishing",
      outcome: "skipped",
    });
  });

  it("finishes only from the last step, then breaks, then closes", () => {
    expect(run([{ type: "FINISH" }], atStep("welcome")).status).toBe("active");
    const finishing = run([{ type: "FINISH" }], atStep("mcp"));
    expect(finishing).toMatchObject({
      status: "finishing",
      outcome: "finished",
    });
    const breaking = run([{ type: "FINISH_OK" }], finishing);
    expect(breaking.status).toBe("breaking");
    expect(run([{ type: "BREAK_DONE" }], breaking)).toEqual({
      status: "closed",
      reason: "finished",
    });
  });

  it("a skip closes without the animation", () => {
    const state = run(
      [{ type: "SKIP_ASK" }, { type: "SKIP_CONFIRM" }, { type: "FINISH_OK" }],
      atStep("welcome"),
    );
    expect(state).toEqual({ status: "closed", reason: "skipped" });
  });

  it("returns to the step when the finish call fails", () => {
    const state = run(
      [{ type: "FINISH" }, { type: "FINISH_FAILED" }],
      atStep("mcp"),
    );
    expect(state).toEqual(atStep("mcp"));
  });

  it("ignores events that do not fit the state", () => {
    expect(run([{ type: "NEXT" }])).toBe(INITIAL_TOUR_STATE);
    expect(run([{ type: "BREAK_DONE" }], atStep("mcp")).status).toBe("active");
  });

  it("treats an unknown event as the safe state: closed", () => {
    const unknown = { type: "WHAT" } as unknown as TourEvent;
    expect(run([unknown], atStep("mcp"))).toEqual({
      status: "closed",
      reason: "error",
    });
  });

  it("fails to closed when start fails", () => {
    expect(run([{ type: "START" }, { type: "START_FAILED" }])).toEqual({
      status: "closed",
      reason: "error",
    });
  });
});
