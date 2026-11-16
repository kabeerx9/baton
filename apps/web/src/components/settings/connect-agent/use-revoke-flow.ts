import { useCallback, useReducer, useRef } from "react";
import { useRevokeMcpGrant } from "@/hooks/mutations/mcp/use-revoke-mcp-grant";
import { IDLE, revokeReducer } from "./revoke-flow";

/** Hosts the revoke lifecycle once. The ref blocks a second request while one is in flight. */
export function useRevokeFlow() {
  const [flow, dispatch] = useReducer(revokeReducer, IDLE);
  const { mutateAsync } = useRevokeMcpGrant();
  const inFlight = useRef(false);

  const confirm = useCallback(
    async (grantId: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      dispatch({ type: "started" });
      try {
        await mutateAsync(grantId);
        dispatch({ type: "succeeded" });
      } catch {
        dispatch({ type: "failed" });
      } finally {
        inFlight.current = false;
      }
    },
    [mutateAsync],
  );

  return {
    flow,
    ask: (grantId: string) => dispatch({ type: "ask", grantId }),
    cancel: () => dispatch({ type: "cancel" }),
    confirm,
  };
}
