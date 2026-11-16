type AssignedTask = {
  projectSlug?: string;
  number?: number | null;
  [field: string]: unknown;
};
export type AssignedTasks = {
  tasks?: AssignedTask[];
  [field: string]: unknown;
};

/**
 * Add the key people say out loud (repo prefix and number, T-5 or API-3) to
 * each task, the same rule as `taskKey` in the API, so agents can refer to
 * tasks by key.
 */
export function withTaskKeys(result: AssignedTasks): AssignedTasks {
  if (!Array.isArray(result?.tasks)) return result;
  return {
    ...result,
    tasks: result.tasks.map((task) =>
      typeof task.projectSlug === "string"
        ? { key: `${task.projectSlug}-${task.number ?? "?"}`, ...task }
        : task,
    ),
  };
}
