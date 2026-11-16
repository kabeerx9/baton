import db from "../../database";
import { activityTable } from "../../database/schema";
import { currentChannel } from "../../events/context";
import type { DbOrTx } from "../../project-access/db-or-tx";

async function createActivity(
  taskId: string,
  type: string,
  userId: string | null,
  content: string | null,
  eventData?: Record<string, unknown> | null,
  // The outbox consumer writes in its delivery transaction and keeps the
  // time the change happened, not the time the relay ran.
  options: { database?: DbOrTx; createdAt?: Date } = {},
) {
  const [activity] = await (options.database ?? db)
    .insert(activityTable)
    .values({
      taskId,
      type,
      userId,
      content,
      eventData: eventData ?? null,
      channel: currentChannel(),
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    })
    .returning();
  return activity;
}

export default createActivity;
