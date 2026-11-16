import { eq } from "drizzle-orm";
import { taskTable, userTable } from "../database/schema";
import type { LocalConsumer } from "../events/outbox/consumer";
import createActivity from "./controllers/create-activity";
import { readActivityPayload } from "./outbox-payload";

export const activityOutboxConsumer: LocalConsumer = {
  name: "activity",
  lane: "local",
  reads: (row) => readActivityPayload(row.type, row.payload) !== null,
  async deliver(tx, row) {
    const payload = readActivityPayload(row.type, row.payload);
    if (!payload) return { kind: "unknown" };
    // KEY SHARE makes a concurrent task or user delete wait, so the
    // insert's foreign keys cannot fail after these checks.
    const [task] = await tx
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(eq(taskTable.id, payload.taskId))
      .for("key share");
    if (!task) return { kind: "dropped", reason: "task_gone" };
    // An actor deleted before delivery leaves the row with no user, the
    // same shape a user delete gives activity that already exists.
    const [actor] = payload.userId
      ? await tx
          .select({ id: userTable.id })
          .from(userTable)
          .where(eq(userTable.id, payload.userId))
          .for("key share")
      : [];
    await createActivity(
      payload.taskId,
      payload.activityType,
      actor?.id ?? null,
      null,
      payload.eventData,
      { database: tx, createdAt: row.createdAt },
    );
    // The board push fired at commit; if this row lands late, the board
    // may have refetched before it, so send one more refetch hint.
    return {
      kind: "delivered",
      lateHint: {
        type: "task.updated",
        data: {
          taskId: payload.taskId,
          projectId: payload.projectId,
          userId: payload.userId,
        },
      },
    };
  },
};
