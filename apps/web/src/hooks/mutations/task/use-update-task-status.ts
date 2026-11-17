import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chooseStatus } from "@/store/task-status/write-status";
import { moveOf } from "@/store/task-status/transition";
import type Task from "@/types/task";

/** A task and the status to write. `isFinal` is the target column's flag; without it only "done" is final. */
export type TaskStatusWrite = Task & { isFinal?: boolean };

/**
 * Writes a task's status through the one per-task writer (store/task-status).
 * It resolves with how this click ended: "applied", "requested" or
 * "superseded". Test `=== "applied"`; any other value means not applied.
 * Every control of a task shares one lifecycle, so `isPending` here says
 * nothing about the task: read the store entry.
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    // The default pauses an offline mutation before it runs, so the click
    // would apply later, unseen. The writer shows and fails it at once.
    networkMode: "always",
    mutationFn: (task: TaskStatusWrite) =>
      chooseStatus({
        queryClient,
        taskId: task.id,
        target: {
          status: task.status,
          isFinal: task.isFinal ?? task.status === "done",
        },
        move: moveOf(task.statusChange),
        title: task.title,
      }),
  });
}
