import { type Rect, sameRect } from "./rect";

/**
 * Where the step's target is. `fallback` means it never mounted in time, so
 * the card centers instead of pointing at nothing.
 */
export type TargetState =
  | { kind: "waiting" }
  | { kind: "found"; rect: Rect }
  | { kind: "fallback" };

export type TargetEvent =
  | { type: "SEEN"; rect: Rect }
  | { type: "LOST" }
  | { type: "TIMEOUT" }
  | { type: "RESET" };

export const TARGET_WAITING: TargetState = { kind: "waiting" };

export function targetReducer(
  state: TargetState,
  event: TargetEvent,
): TargetState {
  switch (event.type) {
    case "SEEN":
      return state.kind === "found" && sameRect(state.rect, event.rect)
        ? state
        : { kind: "found", rect: event.rect };
    case "LOST":
      // A target that unmounts after being seen is a re-render in progress;
      // the timeout decides when to give up.
      return state.kind === "found" ? TARGET_WAITING : state;
    case "TIMEOUT":
      return state.kind === "waiting" ? { kind: "fallback" } : state;
    case "RESET":
      return TARGET_WAITING;
    default:
      return state;
  }
}
