import db from "../../database";
import { activityTable } from "../../database/schema";
import { currentChannel } from "../../events/context";

async function createActivity(
  taskId: string,
  type: string,
  userId: string,
  content: string | null,
  eventData?: Record<string, unknown> | null,
) {
  const [activity] = await db
    .insert(activityTable)
    .values({
      taskId,
      type,
      userId,
      content,
      eventData: eventData ?? null,
      channel: currentChannel(),
    })
    .returning();
  return activity;
}

export default createActivity;
