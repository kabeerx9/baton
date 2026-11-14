import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type db from "../database";
import { projectTable, taskRelationTable, taskTable } from "../database/schema";
import { taskIsOpen } from "../board/open-board-task";
import { canSeeLinkedTask } from "./can-see-linked-task";
import { taskKey } from "./linked-task";

/**
 * A task cannot be finished while a task that blocks it is still open.
 * Starting it is allowed: people often begin against a mock while they wait.
 * Call this only when the task is moving into a final column.
 * The message names only blockers the caller can see; with no caller, it
 * names none.
 */
export async function assertNotBlocked(
  database: Pick<typeof db, "select">,
  taskId: string,
  userId: string | null,
) {
  const message = await findBlockedMessage(database, taskId, userId);
  if (message) throw new HTTPException(409, { message });
}

/** The refusal message when the task has open blockers; null otherwise. */
export async function findBlockedMessage(
  database: Pick<typeof db, "select">,
  taskId: string,
  userId: string | null,
): Promise<string | null> {
  const visible = userId ? canSeeLinkedTask(userId) : sql`false`;
  const blockers = await database
    .select({
      number: taskTable.number,
      slug: projectTable.slug,
      visible: sql<boolean>`${visible}`,
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskTable.id, taskRelationTable.sourceTaskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(taskRelationTable.relationType, "blocks"),
        eq(taskRelationTable.targetTaskId, taskId),
        taskIsOpen,
      ),
    );
  if (blockers.length === 0) return null;

  const names = blockers
    .filter((b) => b.visible)
    .map((b) => taskKey(b.slug, b.number));
  const hidden = blockers.length - names.length;
  if (hidden > 0) {
    names.push(
      hidden === 1 ? "1 task you cannot see" : `${hidden} tasks you cannot see`,
    );
  }
  return `Blocked by ${names.join(", ")}. Finish that first, or remove the link.`;
}
