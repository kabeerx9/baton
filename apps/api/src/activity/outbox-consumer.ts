import { eq } from "drizzle-orm";
import { taskTable } from "../database/schema";
import type { LocalConsumer } from "../events/outbox/consumer";
import createActivity from "./controllers/create-activity";
import { readActivityPayload } from "./outbox-payload";

// The board push fires at commit and this row lands a moment later. The
// 100 ms broadcast queue hides that gap; past this age it may not, so the
// consumer sends one more refetch hint after it writes.
const LATE_DELIVERY_MS = 1_000;

export const activityOutboxConsumer: LocalConsumer = {
  name: "activity",
  lane: "local",
  async deliver(tx, row, { ageMs }) {
    const payload = readActivityPayload(row.type, row.payload);
    if (!payload) return { kind: "unknown" };
    // KEY SHARE makes a concurrent task delete wait, so the insert's
    // foreign key cannot fail after this check.
    const [task] = await tx
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(eq(taskTable.id, payload.taskId))
      .for("key share");
    if (!task) return { kind: "dropped", reason: "task_gone" };
    await createActivity(
      payload.taskId,
      payload.activityType,
      payload.userId,
      null,
      payload.eventData,
      { database: tx, createdAt: row.createdAt },
    );
    if (ageMs <= LATE_DELIVERY_MS) return { kind: "delivered" };
    return {
      kind: "delivered",
      live: {
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
