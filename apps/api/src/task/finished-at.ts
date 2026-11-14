import { sql } from "drizzle-orm";
import { taskTable } from "../database/schema";

/**
 * When the task in scope reached its current status. Falls back to the last
 * edit for a task that was created already finished and so has no status
 * change logged. Team history and the board both read this one definition.
 */
export const finishedAt = sql<Date>`coalesce((
  select max(activity.created_at) from activity
  where activity.task_id = ${taskTable.id}
    and activity.type = 'status_changed'
    and activity.event_data->>'newStatus' = ${taskTable.status}
), ${taskTable.updatedAt})`.mapWith(taskTable.updatedAt);
