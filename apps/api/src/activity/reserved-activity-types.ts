/**
 * Activity types the server writes itself. Clients may not post them: a forged
 * "created" row could otherwise pass as a task's creator in history.
 */
export const RESERVED_ACTIVITY_TYPES = new Set([
  "comment",
  "created",
  "create",
  "task",
  "status_changed",
  "assignee_changed",
  "unassigned",
  "moved",
  "title_changed",
  "priority_changed",
  "due_date_changed",
  "description_changed",
]);

export function isReservedActivityType(type: string) {
  return RESERVED_ACTIVITY_TYPES.has(type) || type.startsWith("change_request");
}
