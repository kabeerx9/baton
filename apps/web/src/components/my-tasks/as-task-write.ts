import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import type Task from "@/types/task";

/**
 * The task mutation hooks take the app's full `Task`, but they read only its
 * id, its project and the field they write. My tasks has the lighter
 * `AssignedTask`, so this fills the `Task` shape: real values where the list
 * has them, null elsewhere. Do not read the null fields downstream.
 */
export function asTaskWrite(
  task: AssignedTask,
  change: Partial<Pick<Task, "status" | "dueDate">>,
): Task {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    number: task.number,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    description: null,
    startDate: null,
    position: null,
    createdAt: "",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    // My tasks lists the person's own work, so a status move applies. The
    // list carries no prediction. If the server answers with a request
    // instead, the writer settles "requested" and the ledger drops the entry.
    statusChange: { move: "apply" },
    ...change,
  };
}
