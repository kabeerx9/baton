import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";

type Waiting = AssignedTask["waiting"][number];

/** A waiting or blocking task for tests. */
export function link(key: string, assigneeName: string | null = null): Waiting {
  return { id: `link-${key}`, key, title: `${key} title`, assigneeName };
}

/** An assigned task for tests: free, undated, to do, unless told otherwise. */
export function assigned(
  id: string,
  extra: Partial<AssignedTask> = {},
): AssignedTask {
  return {
    id,
    projectId: "p-app",
    number: 1,
    title: `Task ${id}`,
    status: "to-do",
    statusName: "To Do",
    statusIcon: null,
    priority: "medium",
    dueDate: null,
    projectName: "App",
    projectSlug: "APP",
    projectIcon: null,
    labels: [],
    waiting: [],
    waitsOn: [],
    hiddenBlockers: 0,
    pendingRequest: null,
    ...extra,
  };
}

/** Noon on the day `offset` days from `day`, as the API sends dates. */
export function dueIn(day: number, offset: number): string {
  const date = new Date(day);
  date.setDate(date.getDate() + offset);
  date.setHours(12);
  return date.toISOString();
}
