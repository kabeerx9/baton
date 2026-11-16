import { and, eq, sql } from "drizzle-orm";
import db, { schema } from "../../../apps/api/src/database";
import type { Lane } from "../../../apps/api/src/events/outbox/routes";
import {
  LANES,
  drainLane,
} from "../../../apps/api/src/events/outbox/start-relay";
import { createProjectFixture, createWorkspaceMember } from "./fixtures";

/**
 * Runs every due outbox row in this process, as the relay would, until
 * none is left. Integration tests do not start the relay loop, so a test
 * that reads activity calls this after the change it makes.
 */
export async function drainOutbox(): Promise<number> {
  let total = 0;
  for (const lane of Object.keys(LANES) as Lane[])
    total += await drainLane(lane);
  return total;
}

export function readOutbox() {
  return db.select().from(schema.outboxTable);
}

/** A workspace admin, a project and a task the admin created. */
export async function outboxTaskFixture() {
  const { user, workspace } = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Outbox task",
      status: "to-do",
      number: 1,
      position: 1,
      createdBy: user.id,
    })
    .returning();
  return { user, workspace, project, columns, task };
}

export function readActivities(taskId: string, type = "status_changed") {
  return db
    .select()
    .from(schema.activityTable)
    .where(
      and(
        eq(schema.activityTable.taskId, taskId),
        eq(schema.activityTable.type, type),
      ),
    );
}

/** Makes every pending row due now, as if its retry wait had passed. */
export async function makeOutboxDue() {
  await db.update(schema.outboxTable).set({
    nextAttemptAt: sql`(now() AT TIME ZONE 'utc') - interval '1 second'`,
  });
}
