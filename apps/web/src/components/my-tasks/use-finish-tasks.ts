import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { toast } from "@/lib/toast";
import { asTaskWrite } from "./as-task-write";
import {
  doneTransition,
  EMPTY_LEDGER,
  stillOpen,
  undoTarget,
} from "./done-ledger";
import { formatNames } from "./format-names";
import { DONE_STATUS, finishBlock, peopleWaiting, taskKey } from "./task-facts";

/**
 * Marks tasks done and reopens them, through the app's status mutation, so the
 * consent rules in BOARD.md apply ("Who can change a task"). The ledger keeps
 * each task's lifecycle; this hook only runs the writes and says what happened.
 *
 * `tasks` and `dataUpdatedAt` are the list as last fetched: the ledger reads
 * them to learn whether the server agrees that a task is gone.
 */
export function useFinishTasks(
  tasks: readonly AssignedTask[],
  dataUpdatedAt: number,
) {
  const { t } = useTranslation();
  const [ledger, dispatch] = useReducer(doneTransition, EMPTY_LEDGER);
  const queryClient = useQueryClient();
  const { mutateAsync: writeStatus } = useUpdateTaskStatus();
  // Undo runs from a toast that outlives the render that made it.
  const latest = useRef(ledger);
  useLayoutEffect(() => {
    latest.current = ledger;
  });
  // The "done" toast of each task, so it can be taken back if the task stays open.
  const doneToasts = useRef(new Map<string, string>());

  useEffect(() => {
    const openIds = new Set(tasks.map((task) => task.id));
    // A task that was written as done and is still listed is a feature: it
    // closes with the tasks under it. Say so, and let it show again.
    for (const task of stillOpen(ledger, openIds, dataUpdatedAt)) {
      toast.dismiss(doneToasts.current.get(task.id));
      toast.info(
        t("workspace:myTasks.toast.stillOpen", { key: taskKey(task) }),
      );
    }
    dispatch({ type: "synced", openIds, updatedAt: dataUpdatedAt });
  }, [tasks, dataUpdatedAt, ledger, t]);

  const reopen = async (id: string) => {
    const entry = latest.current.find((e) => e.task.id === id);
    if (!entry || (entry.kind !== "applied" && entry.kind !== "finished")) {
      return;
    }
    dispatch({ type: "undo", id });
    try {
      const result = await writeStatus(
        asTaskWrite(entry.task, { status: entry.from }),
      );
      // A request means the task did not reopen. The mutation has said so.
      dispatch({
        type: result.outcome === "requested" ? "undoFailed" : "undone",
        id,
      });
    } catch (error) {
      dispatch({ type: "undoFailed", id });
      toast.error(
        (error instanceof Error && error.message) ||
          t("workspace:myTasks.toast.undoError"),
      );
    }
  };

  const finish = async (task: AssignedTask) => {
    const { id } = task;
    if (finishBlock(task) || latest.current.some((e) => e.task.id === id)) {
      return;
    }
    dispatch({ type: "start", task });
    try {
      const result = await writeStatus(
        asTaskWrite(task, { status: DONE_STATUS }),
      );
      if (result.outcome === "requested") {
        // Nothing changed: the mutation showed the "request sent" toast.
        dispatch({ type: "requested", id });
        return;
      }
      dispatch({ type: "applied", id, at: Date.now() });
      // The ledger needs one list read after the write. The mutation started
      // one; this joins it, or starts another when that one is already back.
      void queryClient.refetchQueries(
        { queryKey: ["assigned-tasks"], type: "active" },
        { cancelRefetch: false },
      );
      const names = peopleWaiting(task);
      const shown = toast.success(
        t("workspace:myTasks.toast.done", { key: taskKey(task) }),
        {
          description:
            names.length > 0
              ? t("workspace:myTasks.toast.released", {
                  count: names.length,
                  names: formatNames(names),
                })
              : undefined,
          action: {
            label: t("workspace:myTasks.toast.undo"),
            onClick: () => void reopen(id),
          },
        },
      );
      doneToasts.current.set(id, shown);
    } catch (error) {
      // 409 while blocked, 403, a network failure: the task shows again.
      dispatch({ type: "failed", id });
      toast.error(
        (error instanceof Error && error.message) ||
          t("workspace:myTasks.toast.doneError"),
      );
    }
  };

  return {
    ledger,
    finish,
    /** Reopens the newest task finished on this visit. */
    undoLast: () => {
      const entry = undoTarget(latest.current);
      if (entry) void reopen(entry.task.id);
    },
  };
}
