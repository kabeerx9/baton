import type { QueryClient } from "@tanstack/react-query";
import { dispatchStatus, useTaskStatusStore } from "./store";

type Item = {
  id: string;
  statusGeneration?: number;
  subtasks?: { id: string; statusGeneration?: number }[];
};

/** Every task a board payload carries (a board, or one item), with its generation. */
function tasksIn(data: unknown): Map<string, number | undefined> {
  const found = new Map<string, number | undefined>();
  const { tasks, task } = (data ?? {}) as {
    tasks?: Item[];
    task?: Item | null;
  };
  for (const item of tasks ?? (task ? [task] : [])) {
    found.set(item.id, item.statusGeneration);
    for (const sub of item.subtasks ?? [])
      found.set(sub.id, sub.statusGeneration);
  }
  return found;
}

/**
 * Tells the status entries about every successful read of a task: a task
 * read, or a board payload that carries it. It ends `uncertain` and evicts a
 * `confirmed` entry that a read has caught up with. Mounted once for the app.
 *
 * A read counts by when it was issued, not when it ended. A read already in
 * flight when a write timed out may have been answered before that write
 * landed, so it must not unlock the task. The watcher records the start of
 * every fetch it sees; a fetch it did not see start counts as issued never.
 */
export function watchTaskReads(queryClient: QueryClient): () => void {
  const startedAt = new Map<string, number>();
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    const { action, query } = event;
    if (action.type === "fetch") {
      // A joined fetch sends no second "fetch", so each "fetch" is a new
      // request. One that cancels a read in flight replaces its start.
      startedAt.set(query.queryHash, Date.now());
      return;
    }
    if (action.type === "error") startedAt.delete(query.queryHash);
    // `setQueryData` is no read: only a fetch that reached the server counts.
    if (action.type !== "success" || action.manual) return;
    const issued = startedAt.get(query.queryHash) ?? -1;
    startedAt.delete(query.queryHash);

    const { entries } = useTaskStatusStore.getState();
    const watching = Object.keys(entries).filter(
      (id) =>
        entries[id]?.kind === "uncertain" || entries[id]?.kind === "confirmed",
    );
    if (watching.length === 0) return;

    const [root, id] = query.queryKey;
    if (root === "task" && query.queryKey.length === 2) {
      if (typeof id !== "string" || !watching.includes(id)) return;
      const { statusGeneration } = (query.state.data ?? {}) as {
        statusGeneration?: number;
      };
      dispatchStatus(id, {
        type: "read",
        at: issued,
        generation: statusGeneration,
      });
    } else if (root === "task-board") {
      const carried = tasksIn(query.state.data);
      for (const taskId of watching) {
        if (carried.has(taskId)) {
          dispatchStatus(taskId, {
            type: "read",
            at: issued,
            generation: carried.get(taskId),
          });
        }
      }
    }
  });
}
