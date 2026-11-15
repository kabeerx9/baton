import { produce } from "immer";
import type { ProjectWithTasks } from "@/types/project";

export function applyBoardReorder(
  project: ProjectWithTasks,
  tasks: Array<{ id: string; position: number | null; status?: string }>,
): ProjectWithTasks {
  const changes = new Map(tasks.map((task) => [task.id, task]));
  return produce(project, (draft) => {
    const buckets = [
      ...draft.columns.map((column) => ({
        slug: column.slug,
        columnId: column.id,
        tasks: column.tasks,
      })),
      { slug: "planned", columnId: null, tasks: draft.plannedTasks },
      { slug: "archived", columnId: null, tasks: draft.archivedTasks },
    ];
    const moved: Array<{
      task: (typeof draft.columns)[number]["tasks"][number];
      slug: string;
    }> = [];
    for (const bucket of buckets) {
      for (let index = bucket.tasks.length - 1; index >= 0; index--) {
        const task = bucket.tasks[index];
        const change = changes.get(task.id);
        if (!change) continue;
        task.position = change.position;
        const destination =
          change.status &&
          buckets.find((bucket) => bucket.slug === change.status);
        if (destination && destination !== bucket) {
          task.status = destination.slug;
          task.columnId = destination.columnId;
          bucket.tasks.splice(index, 1);
          moved.push({ task, slug: destination.slug });
        }
      }
    }
    for (const { task, slug } of moved)
      buckets.find((bucket) => bucket.slug === slug)?.tasks.push(task);
    for (const bucket of buckets)
      bucket.tasks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  });
}
