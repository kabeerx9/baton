/**
 * The product tour's lifecycle for one user, stored as one nullable column
 * (`user.tour_completed_at`). Null means the web app shows the tour.
 */
export type TourState = { kind: "pending" } | { kind: "completed"; at: Date };

export type TourCommand = "start" | "finish" | "replay";

/** What one command does to the stored state and the demo workspace. */
export type TourAction =
  /** Delete any demo workspace and seed a fresh one. */
  | { kind: "reset_demo" }
  /** The tour is done; the client must replay before it starts again. */
  | { kind: "refuse_completed" }
  /** Record completion now and delete the demo workspace. */
  | { kind: "complete" }
  /** Already completed: keep the time, delete any demo workspace left over. */
  | { kind: "clean_up" }
  /** Clear completion; the demo workspace is left for the next start. */
  | { kind: "reopen" };

export function toTourState(completedAt: Date | null): TourState {
  return completedAt
    ? { kind: "completed", at: completedAt }
    : { kind: "pending" };
}

/** The one transition rule for every tour route. */
export function decideTour(state: TourState, command: TourCommand): TourAction {
  switch (command) {
    case "start":
      return state.kind === "pending"
        ? { kind: "reset_demo" }
        : { kind: "refuse_completed" };
    case "finish":
      return state.kind === "pending"
        ? { kind: "complete" }
        : { kind: "clean_up" };
    case "replay":
      return { kind: "reopen" };
  }
}
