import { useLocation } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useReducer } from "react";
import { useTourStatus } from "@/hooks/queries/tour/use-tour-status";
import { authClient } from "@/lib/auth-client";
import { gateReducer, shouldHostTour } from "./tour-gate-state";

// The tour (overlay, steps, finish animation) loads only for users who owe it.
const TourHost = lazy(() => import("./tour-host"));

/** Mounted once in the authenticated layout. Cheap when the tour is done. */
export function TourGate() {
  const { data: status, dataUpdatedAt } = useTourStatus();
  const { data: workspaces } = authClient.useListOrganizations();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [gate, dispatch] = useReducer(gateReducer, { status: "idle" });

  const owed = shouldHostTour({
    completed: status?.completed,
    hasRealWorkspace: (workspaces ?? []).some(
      (workspace) => workspace.kind !== "demo",
    ),
    pathname,
  });
  useEffect(() => {
    if (owed) dispatch({ type: "OWED", updatedAt: dataUpdatedAt });
  }, [owed, dataUpdatedAt]);

  const onClosed = useCallback(
    () => dispatch({ type: "CLOSED", at: Date.now() }),
    [],
  );

  if (gate.status !== "hosting") return null;
  return (
    <Suspense fallback={null}>
      <TourHost onClosed={onClosed} />
    </Suspense>
  );
}
