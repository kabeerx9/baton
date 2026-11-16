import { eq } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  taskReminderSentTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent, publishLive } from "../../events";
import { enqueueEvents } from "../../events/outbox/enqueue";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { currentChannel } from "../../events/context";
import createNotification from "../../notification/controllers/create-notification";
import { deleteOrphanedAssets } from "../../storage/cleanup-assets";
import { getSubtaskParentProjects } from "../get-subtask-parent-projects";
import { parseMentionIds } from "../../utils/parse-mentions";

type Task = typeof taskTable.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Changes = Partial<
  Pick<
    Task,
    "title" | "status" | "priority" | "description" | "userId" | "dueDate"
  >
>;
export type TaskBefore = Pick<
  Task,
  "id" | "projectId" | "title" | "status" | "priority" | "userId" | "dueDate"
> & { description?: string | null; columnId?: string | null };

export async function recordTaskMutation(
  tx: Transaction,
  before: TaskBefore,
  changes: Changes,
  userId?: string,
) {
  if (changes.title !== undefined && before.title !== changes.title) {
    await tx.insert(activityTable).values({
      taskId: before.id,
      type: "title_changed",
      userId: userId ?? null,
      content: null,
      eventData: { oldTitle: before.title, newTitle: changes.title },
      channel: userId ? currentChannel() : null,
    });
  }
  if (
    changes.dueDate !== undefined &&
    before.dueDate?.getTime() !== changes.dueDate?.getTime()
  ) {
    await tx
      .delete(taskReminderSentTable)
      .where(eq(taskReminderSentTable.taskId, before.id));
  }
}

type MutationOptions = {
  skipSubtaskParentRefresh?: boolean;
  skipRelationRefresh?: boolean;
  fields?: Array<keyof Changes>;
  assigneeName?: string | null;
  sourceIntegrationId?: string;
};

type MutationEvent = { type: string; data: Record<string, unknown> };

/**
 * The field events one task change produces, in publish order. Shared by
 * the in-transaction enqueue and the post-commit publish, so both see the
 * same data. Reads go through `database`: the caller's transaction or db.
 */
async function buildFieldEvents(
  database: DbOrTx,
  before: Partial<TaskBefore>,
  after: Pick<TaskBefore, "id" | "projectId" | "title"> & Partial<TaskBefore>,
  userId: string | undefined,
  options: MutationOptions,
): Promise<{ status: MutationEvent | null; rest: MutationEvent[] }> {
  const changed = (field: keyof Changes) =>
    (!options.fields || options.fields.includes(field)) &&
    before[field] !== after[field];
  const common = {
    taskId: after.id,
    projectId: after.projectId,
    userId,
    title: after.title,
    ...(options.sourceIntegrationId
      ? { sourceIntegrationId: options.sourceIntegrationId }
      : {}),
  };
  const status = changed("status")
    ? {
        type: "task.status_changed",
        data: {
          ...common,
          oldStatus: before.status,
          newStatus: after.status,
          assigneeId: after.userId,
          type: "status_changed",
          ...(options.skipSubtaskParentRefresh
            ? { skipSubtaskParentRefresh: true }
            : {}),
        },
      }
    : null;
  const rest: MutationEvent[] = [];
  if (changed("title"))
    rest.push({
      type: "task.title_changed",
      data: {
        ...common,
        oldTitle: before.title,
        newTitle: after.title,
        type: "title_changed",
      },
    });
  if (changed("priority"))
    rest.push({
      type: "task.priority_changed",
      data: {
        ...common,
        oldPriority: before.priority,
        newPriority: after.priority,
        type: "priority_changed",
      },
    });
  if (changed("userId")) {
    const assignee =
      options.assigneeName !== undefined
        ? { name: options.assigneeName ?? undefined }
        : after.userId
          ? (
              await database
                .select({ name: userTable.name })
                .from(userTable)
                .where(eq(userTable.id, after.userId))
                .limit(1)
            )[0]
          : undefined;
    rest.push({
      type: after.userId ? "task.assignee_changed" : "task.unassigned",
      data: {
        ...common,
        oldAssignee: before.userId,
        newAssignee: assignee?.name,
        newAssigneeId: after.userId,
        type: after.userId ? "assignee_changed" : "unassigned",
      },
    });
  }
  if (
    (!options.fields || options.fields.includes("dueDate")) &&
    before.dueDate?.getTime() !== after.dueDate?.getTime()
  )
    rest.push({
      type: "task.due_date_changed",
      data: {
        ...common,
        oldDueDate: before.dueDate,
        newDueDate: after.dueDate,
        type: "due_date_changed",
      },
    });
  if (
    (!options.fields || options.fields.includes("description")) &&
    before.description !== undefined &&
    before.description !== after.description
  )
    rest.push({
      type: "task.description_changed",
      data: {
        ...common,
        oldDescription: before.description,
        newDescription: after.description,
        type: "description_changed",
      },
    });
  return { status, rest };
}

/**
 * Writes the outbox rows for a task change inside its transaction. The
 * caller then publishes with `publishTaskMutation(..., { enqueued: true })`.
 */
export async function enqueueTaskMutation(
  tx: Transaction,
  before: Partial<TaskBefore>,
  after: Pick<TaskBefore, "id" | "projectId" | "title"> & Partial<TaskBefore>,
  userId?: string,
  options: MutationOptions = {},
) {
  const { status, rest } = await buildFieldEvents(
    tx,
    before,
    after,
    userId,
    options,
  );
  await enqueueEvents(tx, status ? [status, ...rest] : rest);
}

export async function publishTaskMutation(
  before: Partial<TaskBefore>,
  after: Pick<TaskBefore, "id" | "projectId" | "title"> & Partial<TaskBefore>,
  userId?: string,
  options: MutationOptions & {
    /** The rows were written by `enqueueTaskMutation` in the transaction. */
    enqueued?: boolean;
  } = {},
) {
  const publish = options.enqueued ? publishLive : publishEvent;
  const { status, rest } = await buildFieldEvents(
    db,
    before,
    after,
    userId,
    options,
  );
  if (status) await publish(status.type, status.data);
  const statusChanged = status !== null;
  const columnChanged =
    (!options.fields || options.fields.includes("status")) &&
    before.columnId !== undefined &&
    after.columnId !== undefined &&
    before.columnId !== after.columnId;
  if (columnChanged && !statusChanged && !options.skipSubtaskParentRefresh)
    await publishEvent("subtask-parents.refresh", {
      projects: await getSubtaskParentProjects([after.id]),
    });
  if (!options.skipRelationRefresh && (statusChanged || columnChanged))
    await publishEvent("task-relation.refresh", {
      projectId: after.projectId,
      userId,
    });
  for (const event of rest) await publish(event.type, event.data);
  if (
    (!options.fields || options.fields.includes("description")) &&
    before.description !== undefined &&
    before.description !== after.description
  ) {
    deleteOrphanedAssets(before.description, after.description, {
      taskId: after.id,
    }).catch(() => {});
    const oldMentions = new Set(parseMentionIds(before.description));
    const newlyMentioned = parseMentionIds(after.description).filter(
      (id) => id !== userId && !oldMentions.has(id),
    );
    if (newlyMentioned.length) {
      const editor = userId
        ? (
            await db
              .select({ name: userTable.name })
              .from(userTable)
              .where(eq(userTable.id, userId))
              .limit(1)
          )[0]
        : undefined;
      for (const mentionedId of newlyMentioned)
        await createNotification({
          userId: mentionedId,
          type: "task_mention",
          eventData: {
            taskTitle: after.title,
            mentionerName: editor?.name ?? null,
          },
          resourceId: after.id,
          resourceType: "task",
        });
    }
  }
}
