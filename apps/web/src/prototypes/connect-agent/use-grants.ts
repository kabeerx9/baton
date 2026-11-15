import { useCallback, useReducer } from "react";
import { type GrantsState, grantsReducer, initialState } from "./grants-state";
import type { Scenario } from "./types";

// Stands in for GET and DELETE /api/mcp/grants. The timeouts sit on the fake
// calls, not in the state.
const LATENCY_MS = 650;
const wait = () =>
  new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS));

export function useGrants(scenario: Scenario) {
  const [state, dispatch] = useReducer(grantsReducer, scenario, (s) =>
    initialState(s, Date.now()),
  );

  const retry = useCallback(async () => {
    dispatch({ type: "reload" });
    await wait();
    // The fake API keeps failing in the error scenario, so retry is visible.
    dispatch({ type: "load-failed" });
  }, []);

  const confirmRevoke = useCallback(async (grantId: string) => {
    dispatch({ type: "revoke-started" });
    await wait();
    dispatch({ type: "revoke-succeeded", grantId });
  }, []);

  return { state: state satisfies GrantsState, dispatch, retry, confirmRevoke };
}
