import { and, eq, inArray } from "drizzle-orm";
import { projectTable, taskTable } from "../../database/schema";
import type { OutboxTransaction } from "../../events/outbox/consumer";
import { DEMO_TASKS } from "./demo-tasks";
import type { SeededDemo } from "./seed-demo-workspace";

/**
 * Seeding claims the first numbers of a fresh board project in
 * `DEMO_TASKS` order, so a demo task's number names its key. Numbers stay
 * fixed when the user renames or moves a task during the tour.
 */
export const demoTaskNumber = (index: number) => index + 1;

/**
 * An existing demo workspace in the shape `start` returns, or null when a
 * demo task the tour needs is gone. The caller holds the demo row lock.
 */
export async function readDemoWorkspace(
  tx: OutboxTransaction,
  demo: { id: string; slug: string },
): Promise<SeededDemo | null> {
  const [project] = await tx
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, demo.id),
        eq(projectTable.kind, "board"),
      ),
    )
    .limit(1);
  if (!project) return null;
  const rows = await tx
    .select({ id: taskTable.id, number: taskTable.number })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, project.id),
        inArray(
          taskTable.number,
          DEMO_TASKS.map((_, index) => demoTaskNumber(index)),
        ),
      ),
    );
  const byNumber = new Map(rows.map((row) => [row.number, row.id]));
  const tasks: SeededDemo["tasks"] = [];
  for (const [index, task] of DEMO_TASKS.entries()) {
    const number = demoTaskNumber(index);
    const id = byNumber.get(number);
    if (!id) return null;
    tasks.push({ key: task.key, id, number });
  }
  return {
    demoWorkspace: { id: demo.id, slug: demo.slug, projectId: project.id },
    tasks,
  };
}
