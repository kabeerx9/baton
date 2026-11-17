import type { QueryClient } from "@tanstack/react-query";
import { dispatchStatus, useTaskStatusStore } from "./store";

/** The ids of every task a board payload carries: a board, or one item. */
function taskIdsIn(data: unknown): Set<string> {
  const ids = new Set<string>();
  const { tasks, task } = (data ?? {}) as {
    tasks?: { id: string; subtasks?: { id: string }[] }[];
    task?: { id: string; subtasks?: { id: string }[] } | null;
  };
  for (const item of tasks ?? (task ? [task] : [])) {
    ids.add(item.id);
    for (const sub of item.subtasks ?? []) ids.add(sub.id);
  }
  return ids;
}

/**
 * Tells the status entries about every successful read of a task: a task
 * read, or a board payload that carries it. This is the one place that ends
 * `uncertain`, so a failed recovery refetch is not the last chance. Mounted
 * once for the app.
 */
export function watchTaskReads(queryClient: QueryClient): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    // `setQueryData` is no read: only a fetch that reached the server counts.
    if (event.type !== "updated" || event.action.type !== "success") return;
    if (event.action.manual) return;
    const { entries } = useTaskStatusStore.getState();
    const uncertain = Object.keys(entries).filter(
      (id) => entries[id]?.kind === "uncertain",
    );
    if (uncertain.length === 0) return;

    const [root, id] = event.query.queryKey;
    const at = event.query.state.dataUpdatedAt;
    if (root === "task" && event.query.queryKey.length === 2) {
      if (typeof id === "string") dispatchStatus(id, { type: "read", at });
    } else if (root === "task-board") {
      const carried = taskIdsIn(event.query.state.data);
      for (const taskId of uncertain) {
        if (carried.has(taskId)) dispatchStatus(taskId, { type: "read", at });
      }
    }
  });
}
