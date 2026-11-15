import type { McpGrant, Scenario } from "./types";
import { makeGrants } from "./fixtures";

// One lifecycle for the list, one for a revoke in flight. Both are unions,
// both change only through `grantsReducer`.
export type GrantsList =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; grants: McpGrant[] };

export type RevokeFlow =
  | { status: "idle" }
  | { status: "confirming"; grantId: string }
  | { status: "revoking"; grantId: string }
  | { status: "failed"; grantId: string };

export type GrantsState = { list: GrantsList; revoke: RevokeFlow };

export type GrantsAction =
  | { type: "reload" }
  | { type: "loaded"; grants: McpGrant[] }
  | { type: "load-failed" }
  | { type: "ask-revoke"; grantId: string }
  | { type: "cancel-revoke" }
  | { type: "revoke-started" }
  | { type: "revoke-succeeded"; grantId: string }
  | { type: "revoke-failed" }
  | { type: "connected"; grant: McpGrant };

const IDLE: RevokeFlow = { status: "idle" };

/** The state a scenario starts in. Only loading and error skip the list. */
export function initialState(scenario: Scenario, now: number): GrantsState {
  switch (scenario) {
    case "loading":
      return { list: { status: "loading" }, revoke: IDLE };
    case "error":
      return { list: { status: "error" }, revoke: IDLE };
    case "empty":
      return { list: { status: "ready", grants: [] }, revoke: IDLE };
    default:
      return {
        list: { status: "ready", grants: makeGrants(now) },
        revoke: IDLE,
      };
  }
}

export function grantsReducer(
  state: GrantsState,
  action: GrantsAction,
): GrantsState {
  switch (action.type) {
    case "reload":
      return { list: { status: "loading" }, revoke: IDLE };
    case "loaded":
      return { list: { status: "ready", grants: action.grants }, revoke: IDLE };
    case "load-failed":
      return { list: { status: "error" }, revoke: IDLE };
    case "ask-revoke":
      if (state.list.status !== "ready" || state.revoke.status === "revoking")
        return state;
      return {
        ...state,
        revoke: { status: "confirming", grantId: action.grantId },
      };
    case "cancel-revoke":
      if (state.revoke.status === "revoking") return state;
      return { ...state, revoke: IDLE };
    case "revoke-started":
      if (
        state.revoke.status !== "confirming" &&
        state.revoke.status !== "failed"
      )
        return state;
      return {
        ...state,
        revoke: { status: "revoking", grantId: state.revoke.grantId },
      };
    case "revoke-succeeded":
      if (state.list.status !== "ready") return state;
      return {
        list: {
          status: "ready",
          grants: state.list.grants.filter((g) => g.id !== action.grantId),
        },
        revoke: IDLE,
      };
    case "revoke-failed":
      if (state.revoke.status !== "revoking") return state;
      return {
        ...state,
        revoke: { status: "failed", grantId: state.revoke.grantId },
      };
    case "connected":
      if (state.list.status !== "ready") return state;
      return {
        ...state,
        list: { status: "ready", grants: [action.grant, ...state.list.grants] },
      };
    default:
      // An unknown action leaves the state as it is.
      return state;
  }
}

/** The grant a revoke dialog is about, or null when the dialog is closed. */
export function pendingGrant(state: GrantsState): McpGrant | null {
  if (state.list.status !== "ready" || state.revoke.status === "idle")
    return null;
  const { grantId } = state.revoke;
  return state.list.grants.find((g) => g.id === grantId) ?? null;
}
