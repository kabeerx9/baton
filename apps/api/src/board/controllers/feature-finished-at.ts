/**
 * A plain task keeps its own finish time. A feature finished when its last
 * visible subtask did, and only once its column is done.
 */
export function featureFinishedAt(
  task: { finishedAt: Date | null },
  column: string,
  subtasks: Array<{ finishedAt: Date | null }>,
) {
  if (subtasks.length === 0) return task.finishedAt;
  if (column !== "done") return null;
  let latest: Date | null = null;
  for (const { finishedAt } of subtasks) {
    if (finishedAt && (!latest || finishedAt > latest)) latest = finishedAt;
  }
  return latest;
}
