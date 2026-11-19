/** The capabilities that decide whether the caller may work on one task. */
export type TaskWorkCapabilities = {
  /** task:update: every task. */
  updateTasks: boolean;
  /** task:update_assigned: tasks assigned to the caller. */
  updateAssignedTasks: boolean;
};

/**
 * Whether the caller may change this task's status, fields and comments,
 * by the same rule the API enforces: task:update, or task:update_assigned
 * on a task assigned to the caller. An unknown caller or assignee is never
 * the caller's own task.
 */
export function canWorkOnTask(
  can: TaskWorkCapabilities,
  userId: string | null | undefined,
  assigneeId: string | null | undefined,
): boolean {
  if (can.updateTasks) return true;
  return Boolean(can.updateAssignedTasks && userId && assigneeId === userId);
}
