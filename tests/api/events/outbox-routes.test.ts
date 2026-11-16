import { describe, expect, it } from "vite-plus/test";
import { outboxRows } from "../../../apps/api/src/events/outbox/enqueue";
import {
  CONSUMER_LANE,
  OUTBOX_ROUTES,
  isDurableEvent,
} from "../../../apps/api/src/events/outbox/routes";

const LIVE_ONLY = [
  "task.updated",
  "project.updated",
  "tasks.reordered",
  "task-relation.refresh",
  "task-relation.deleted",
  "subtask-parents.refresh",
  "comment.updated",
  "comment.deleted",
  "task_change_request.updated",
  "task.bulk_unassigned",
  "notification.created",
  "project_access.updated",
  "project_members.updated",
];

const sample: Record<string, Record<string, unknown>> = {
  "task.created": {
    taskId: "t",
    projectId: "p",
    currentUserId: "u",
    type: "created",
  },
  "task.moved": {
    taskId: "t",
    userId: "u",
    type: "moved",
    fromProjectId: "p0",
    fromProjectName: "Old",
    toProjectId: "p",
    toProjectName: "New",
    oldStatus: "a",
    newStatus: "b",
  },
  "task.status_changed": {
    taskId: "t",
    projectId: "p",
    userId: "u",
    type: "status_changed",
    oldStatus: "a",
    newStatus: "b",
  },
  "task.priority_changed": {
    taskId: "t",
    projectId: "p",
    userId: "u",
    type: "priority_changed",
    oldPriority: "low",
    newPriority: "high",
  },
  "task.unassigned": {
    taskId: "t",
    projectId: "p",
    userId: "u",
    type: "unassigned",
  },
  "task.assignee_changed": {
    taskId: "t",
    projectId: "p",
    userId: "u",
    type: "assignee_changed",
    newAssigneeId: "u",
    newAssignee: "Ann",
  },
  "task.due_date_changed": {
    taskId: "t",
    projectId: "p",
    userId: "u",
    type: "due_date_changed",
    oldDueDate: null,
    newDueDate: new Date("2030-01-01T00:00:00.000Z"),
  },
};

describe("outbox routes", () => {
  it.each(LIVE_ONLY)("writes no row for live-only %s", (type) => {
    expect(isDurableEvent(type)).toBe(false);
    expect(outboxRows({ type, data: { taskId: "t", projectId: "p" } })).toEqual(
      [],
    );
  });

  it("routes exactly the seven activity events in phase 1", () => {
    expect(Object.keys(OUTBOX_ROUTES).sort()).toEqual(
      Object.keys(sample).sort(),
    );
  });

  it.each(Object.keys(sample))(
    "resolves a scope and a payload for %s",
    (type) => {
      const rows = outboxRows({ type, data: sample[type] });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type, consumer: "activity" });
      expect(rows[0]!.payload).toMatchObject({
        v: 1,
        taskId: "t",
        projectId: "p",
      });
      expect(rows[0]!.workspaceId).toBeDefined();
    },
  );

  it("puts every consumer in a lane", () => {
    for (const route of Object.values(OUTBOX_ROUTES))
      for (const consumer of Object.keys(route.consumers))
        expect(CONSUMER_LANE).toHaveProperty(consumer);
  });

  it("stores due dates as ISO strings", () => {
    const [row] = outboxRows({
      type: "task.due_date_changed",
      data: sample["task.due_date_changed"],
    });
    expect(row!.payload).toMatchObject({
      eventData: { oldDueDate: null, newDueDate: "2030-01-01T00:00:00.000Z" },
    });
  });

  it("writes no row for a task created without a person", () => {
    expect(
      outboxRows({
        type: "task.created",
        data: { ...sample["task.created"], currentUserId: undefined },
      }),
    ).toEqual([]);
  });

  it("refuses an event with no project", () => {
    expect(() =>
      outboxRows({
        type: "task.status_changed",
        data: { ...sample["task.status_changed"], projectId: undefined },
      }),
    ).toThrow();
  });
});
