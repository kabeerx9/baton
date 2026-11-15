import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vite-plus/test";
import type { AssignedTasks } from "@/fetchers/task/get-assigned-tasks";
import { patchAssignedDueDate } from "./patch-assigned-due-date";
import { assigned } from "./test-task";

const key = ["assigned-tasks", "w1", { countOnly: false }];
const countKey = ["assigned-tasks", "w1", { countOnly: true }];

it("moves one task's date in the cached list and leaves the rest alone", () => {
  const client = new QueryClient();
  const other = assigned("b", { dueDate: "2026-11-20T12:00:00.000Z" });
  const before: AssignedTasks = { tasks: [assigned("a"), other], total: 2 };
  const count: AssignedTasks = { tasks: [], total: 2 };
  client.setQueryData(key, before);
  client.setQueryData(countKey, count);

  patchAssignedDueDate(client, "a", "2026-11-16T12:00:00.000Z");

  const after = client.getQueryData<AssignedTasks>(key);
  expect(after?.tasks[0]?.dueDate).toBe("2026-11-16T12:00:00.000Z");
  expect(after?.tasks[1]).toBe(other);
  // A list without the task keeps its identity, so it does not re-render.
  expect(client.getQueryData(countKey)).toBe(count);
});

it("clears a date and does nothing before any list has loaded", () => {
  const client = new QueryClient();
  patchAssignedDueDate(client, "a", null);
  expect(client.getQueryData(key)).toBeUndefined();

  client.setQueryData(key, {
    tasks: [assigned("a", { dueDate: "2026-11-20T12:00:00.000Z" })],
    total: 1,
  });
  patchAssignedDueDate(client, "a", null);
  expect(client.getQueryData<AssignedTasks>(key)?.tasks[0]?.dueDate).toBeNull();
});
