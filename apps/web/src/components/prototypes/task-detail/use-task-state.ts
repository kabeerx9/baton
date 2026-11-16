import { useEffect, useReducer } from "react";
import { toastManager } from "@/components/ui/toast-manager";
import { DATA_SETS } from "./mock-data";
import { KABEER, SAM } from "./people";
import { initialState, taskReducer } from "./task-state";
import type { DataSetId, Viewer } from "./types";

export const VIEWERS = {
  me: { person: KABEER, involved: true },
  member: { person: SAM, involved: false },
} as const satisfies Record<string, Viewer>;

export type ViewerId = keyof typeof VIEWERS;

/** One reducer for the mock task. Switching data set remounts it (see the harness key). */
export function useTaskState(dataSet: DataSetId) {
  const [state, dispatch] = useReducer(
    taskReducer,
    DATA_SETS[dataSet].task,
    initialState,
  );

  // Toast once per outcome. The outcome id changes on every action that speaks.
  const { outcome } = state;
  useEffect(() => {
    if (outcome.kind === "none") return;
    toastManager.add({
      title: outcome.message,
      type: outcome.kind === "refused" ? "error" : "success",
    });
  }, [outcome]);

  return { task: state.task, dispatch };
}
