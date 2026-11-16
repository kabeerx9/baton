import type { DemoTaskKey, TourOutcome } from "@/fetchers/tour/types";
import type { DemoSnapshot } from "./demo-snapshot";
import {
  FIRST_STEP,
  LAST_STEP,
  nextStep,
  STEPS,
  type StepId,
} from "./tour-steps";

/** What the tour needs to know about the demo it is running in. */
export type TourSession = {
  demoWorkspaceId: string;
  taskIds: Record<DemoTaskKey, string>;
  /** The real workspace to return to. `null` lets the host pick one. */
  originWorkspaceId: string | null;
};

export type CloseReason = "finished" | "skipped" | "demo-missing" | "error";

/**
 * The tour's whole lifecycle. `closed` is the safe state: an unknown status
 * or event leaves the user with a normal app.
 */
export type TourState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "active"; step: StepId; session: TourSession }
  | { status: "confirming-skip"; step: StepId; session: TourSession }
  | {
      status: "finishing";
      outcome: TourOutcome;
      /** Where to return to if the finish call fails. */
      resume: StepId;
      session: TourSession;
    }
  /** The finish animation plays over the real workspace. */
  | { status: "breaking"; session: TourSession }
  | { status: "closed"; reason: CloseReason };

export type TourEvent =
  | { type: "START" }
  | { type: "STARTED"; session: TourSession }
  | { type: "START_FAILED" }
  | { type: "NEXT" }
  | { type: "DATA"; snapshot: DemoSnapshot }
  | { type: "SKIP_ASK" }
  | { type: "SKIP_CANCEL" }
  | { type: "SKIP_CONFIRM" }
  | { type: "FINISH" }
  | { type: "FINISH_OK" }
  | { type: "FINISH_FAILED" }
  | { type: "BREAK_DONE" };

export const INITIAL_TOUR_STATE: TourState = { status: "idle" };

const CLOSED_ERROR: TourState = { status: "closed", reason: "error" };

/** True while the tour owns the screen (overlay, focus, Escape). */
export function isTourVisible(state: TourState) {
  return (
    state.status === "active" ||
    state.status === "confirming-skip" ||
    state.status === "finishing" ||
    state.status === "breaking"
  );
}

function onData(state: TourState, snapshot: DemoSnapshot): TourState {
  if (state.status !== "active" && state.status !== "confirming-skip") {
    return state;
  }
  if (snapshot.status === "gone") {
    return { status: "closed", reason: "demo-missing" };
  }
  if (snapshot.status !== "ready") return state;
  if (snapshot.missing) return { status: "closed", reason: "demo-missing" };
  // Data, never a click, moves the interactive step.
  if (
    state.status === "active" &&
    state.step === "move-task" &&
    snapshot.apiEndpointDone
  ) {
    return { ...state, step: "unblocked" };
  }
  return state;
}

export function tourReducer(state: TourState, event: TourEvent): TourState {
  switch (event.type) {
    case "START":
      return state.status === "idle" ? { status: "starting" } : state;
    case "STARTED":
      return state.status === "starting"
        ? { status: "active", step: FIRST_STEP, session: event.session }
        : state;
    case "START_FAILED":
      return state.status === "starting" ? CLOSED_ERROR : state;
    case "NEXT": {
      if (state.status !== "active") return state;
      if (STEPS[state.step].waitsForData) return state;
      const step = nextStep(state.step);
      return step ? { ...state, step } : state;
    }
    case "DATA":
      return onData(state, event.snapshot);
    case "SKIP_ASK":
      return state.status === "active"
        ? {
            status: "confirming-skip",
            step: state.step,
            session: state.session,
          }
        : state;
    case "SKIP_CANCEL":
      return state.status === "confirming-skip"
        ? { status: "active", step: state.step, session: state.session }
        : state;
    case "SKIP_CONFIRM":
      return state.status === "confirming-skip"
        ? {
            status: "finishing",
            outcome: "skipped",
            resume: state.step,
            session: state.session,
          }
        : state;
    case "FINISH":
      return state.status === "active" && state.step === LAST_STEP
        ? {
            status: "finishing",
            outcome: "finished",
            resume: state.step,
            session: state.session,
          }
        : state;
    case "FINISH_OK":
      if (state.status !== "finishing") return state;
      return state.outcome === "finished"
        ? { status: "breaking", session: state.session }
        : { status: "closed", reason: "skipped" };
    case "FINISH_FAILED":
      return state.status === "finishing"
        ? { status: "active", step: state.resume, session: state.session }
        : state;
    case "BREAK_DONE":
      return state.status === "breaking"
        ? { status: "closed", reason: "finished" }
        : state;
    default:
      return CLOSED_ERROR;
  }
}
