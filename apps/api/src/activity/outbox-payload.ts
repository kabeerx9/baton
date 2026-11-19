// The facts the activity consumer reads from an outbox row. Built at
// enqueue time from the event data, so a row never carries a whole task
// row or a description (`task.created` spreads the full task).

export const ACTIVITY_PAYLOAD_VERSION = 1;

export type ActivityPayload = {
  v: typeof ACTIVITY_PAYLOAD_VERSION;
  taskId: string;
  /** Null only on a malformed event; the enqueue then refuses the row. */
  projectId: string | null;
  userId: string | null;
  activityType: string;
  eventData: Record<string, unknown>;
};

type Data = Record<string, unknown>;

const text = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

const isoDate = (value: unknown) =>
  value instanceof Date ? value.toISOString() : (value ?? null);

/** One picker per event type: the event data the activity consumer reads. */
const PICKERS: Record<
  string,
  (data: Data) => { userId: unknown; eventData: Record<string, unknown> }
> = {
  // A task created without a person (a GitHub import) records no activity.
  "task.created": (data) => ({ userId: data.currentUserId, eventData: {} }),
  "task.moved": (data) => ({
    userId: data.userId,
    eventData: {
      fromProjectId: data.fromProjectId,
      fromProjectName: data.fromProjectName,
      toProjectId: data.toProjectId,
      toProjectName: data.toProjectName,
      oldStatus: data.oldStatus,
      newStatus: data.newStatus,
    },
  }),
  "task.status_changed": (data) => ({
    userId: data.userId,
    eventData: { oldStatus: data.oldStatus, newStatus: data.newStatus },
  }),
  "task.priority_changed": (data) => ({
    userId: data.userId,
    eventData: { oldPriority: data.oldPriority, newPriority: data.newPriority },
  }),
  "task.unassigned": (data) => ({ userId: data.userId, eventData: {} }),
  "task.assignee_changed": (data) => ({
    userId: data.userId,
    eventData: {
      newAssigneeId: data.newAssigneeId,
      newAssignee: data.newAssignee,
      isSelfAssigned: data.userId === data.newAssigneeId,
    },
  }),
  "task.due_date_changed": (data) => ({
    userId: data.userId,
    eventData: {
      oldDueDate: isoDate(data.oldDueDate),
      newDueDate: isoDate(data.newDueDate),
    },
  }),
};

export const ACTIVITY_EVENT_TYPES = Object.keys(PICKERS);

/** Returns null when the event records no activity, so no row is written. */
export function toActivityPayload(
  type: string,
  data: unknown,
): ActivityPayload | null {
  const pick = PICKERS[type];
  if (!pick || typeof data !== "object" || data === null) return null;
  const event = data as Data;
  const taskId = text(event.taskId);
  const activityType = text(event.type);
  const projectId = text(
    type === "task.moved" ? event.toProjectId : event.projectId,
  );
  const { userId, eventData } = pick(event);
  if (!taskId || !activityType) return null;
  if (type === "task.created" && !text(userId)) return null;
  return {
    v: ACTIVITY_PAYLOAD_VERSION,
    taskId,
    projectId,
    userId: text(userId),
    activityType,
    eventData,
  };
}

/** Returns null for a payload this code cannot read (a newer version). */
export function readActivityPayload(
  type: string,
  payload: unknown,
): ActivityPayload | null {
  if (!PICKERS[type] || typeof payload !== "object" || payload === null)
    return null;
  const value = payload as Partial<ActivityPayload>;
  if (
    value.v !== ACTIVITY_PAYLOAD_VERSION ||
    typeof value.taskId !== "string" ||
    typeof value.projectId !== "string" ||
    typeof value.activityType !== "string" ||
    (value.userId !== null && typeof value.userId !== "string") ||
    typeof value.eventData !== "object" ||
    value.eventData === null
  )
    return null;
  return value as ActivityPayload;
}
