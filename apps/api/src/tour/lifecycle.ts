/**
 * The product tour's lifecycle for one user, stored as one nullable column
 * (`user.tour_completed_at`). Null means the web app shows the tour.
 */
export type TourState = { kind: "pending" } | { kind: "completed"; at: Date };

/**
 * The user's demo workspace as `start` finds it. `broken` means a demo task
 * the tour needs is gone, so the tour cannot continue in it.
 */
export type DemoState = "none" | "intact" | "broken";

export type TourCommand = "start" | "finish" | "replay";

/** What one command does to the stored state and the demo workspace. */
export type TourAction =
  /** No demo yet: seed one. */
  | { kind: "seed_demo" }
  /** A tour is running: return its demo unchanged (a reload, a second tab). */
  | { kind: "resume_demo" }
  /** The demo lost a tour task: delete it and seed a fresh one. */
  | { kind: "reset_demo" }
  /** The tour is done; the client must replay before it starts again. */
  | { kind: "refuse_completed" }
  /** Record completion now and delete the demo workspace. */
  | { kind: "complete" }
  /** Already completed: keep the time, delete any demo workspace left over. */
  | { kind: "clean_up" }
  /**
   * Clear completion only. A running demo stays: replay can fire mid-tour,
   * and start then resumes it. After a finish no demo is left.
   */
  | { kind: "reopen" };

export function toTourState(completedAt: Date | null): TourState {
  return completedAt
    ? { kind: "completed", at: completedAt }
    : { kind: "pending" };
}

/**
 * The one transition rule for every tour route. Start is idempotent while
 * the tour runs; only finish and the cleanup job delete a demo, and start
 * replaces a demo that lost a tour task.
 */
export function decideTour(
  state: TourState,
  command: TourCommand,
  demo: DemoState = "none",
): TourAction {
  switch (command) {
    case "start":
      if (state.kind !== "pending") return { kind: "refuse_completed" };
      if (demo === "intact") return { kind: "resume_demo" };
      return demo === "broken" ? { kind: "reset_demo" } : { kind: "seed_demo" };
    case "finish":
      return state.kind === "pending"
        ? { kind: "complete" }
        : { kind: "clean_up" };
    case "replay":
      return { kind: "reopen" };
  }
}
