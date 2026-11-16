/** Whether the tour should run now: it is owed, and the user is in the app. */
export function shouldHostTour(input: {
  completed: boolean | undefined;
  hasRealWorkspace: boolean;
  pathname: string;
}) {
  if (input.completed !== false || !input.hasRealWorkspace) return false;
  // Only inside the app proper: not onboarding, profile setup or an invite.
  return (
    input.pathname.startsWith("/dashboard/") &&
    !input.pathname.startsWith("/dashboard/invitations")
  );
}

/**
 * The gate's own lifecycle. `closed` remembers when the tour ended, so a
 * stale "owed" answer cannot restart it; only newer status data (a replay)
 * can.
 */
export type GateState =
  | { status: "idle" }
  | { status: "hosting" }
  | { status: "closed"; at: number };

export type GateEvent =
  | { type: "OWED"; updatedAt: number }
  | { type: "CLOSED"; at: number };

export function gateReducer(state: GateState, event: GateEvent): GateState {
  switch (event.type) {
    case "OWED":
      if (state.status === "idle") return { status: "hosting" };
      if (state.status === "closed" && event.updatedAt > state.at) {
        return { status: "hosting" };
      }
      return state;
    case "CLOSED":
      return state.status === "hosting"
        ? { status: "closed", at: event.at }
        : state;
    default:
      return state;
  }
}
