// The revoke dialog lifecycle. One union, one pure transition. The list itself
// is owned by the query, not by this state.
export type RevokeFlow =
  | { status: "idle" }
  | { status: "confirming"; grantId: string }
  | { status: "revoking"; grantId: string }
  | { status: "failed"; grantId: string };

export type RevokeAction =
  | { type: "ask"; grantId: string }
  | { type: "cancel" }
  | { type: "started" }
  | { type: "succeeded" }
  | { type: "failed" };

export const IDLE: RevokeFlow = { status: "idle" };

export function revokeReducer(
  state: RevokeFlow,
  action: RevokeAction,
): RevokeFlow {
  switch (action.type) {
    case "ask":
      return state.status === "revoking"
        ? state
        : { status: "confirming", grantId: action.grantId };
    case "cancel":
      return state.status === "revoking" ? state : IDLE;
    case "started":
      return state.status === "confirming" || state.status === "failed"
        ? { status: "revoking", grantId: state.grantId }
        : state;
    case "succeeded":
      return state.status === "revoking" ? IDLE : state;
    case "failed":
      return state.status === "revoking"
        ? { status: "failed", grantId: state.grantId }
        : state;
    default:
      // An unknown action keeps the state, never starts a revoke.
      return state;
  }
}
