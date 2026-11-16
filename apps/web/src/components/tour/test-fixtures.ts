import type { BoardResponse } from "@/fetchers/board/get-board";
import { DEMO_TASK_KEYS, type DemoTaskKey } from "@/fetchers/tour/types";

export const TASK_IDS = Object.fromEntries(
  DEMO_TASK_KEYS.map((key) => [key, `id-${key}`]),
) as Record<DemoTaskKey, string>;

type Overrides = {
  apiDone?: boolean;
  without?: DemoTaskKey;
};

/** A demo board with just the fields the tour reads. */
export function demoBoard({ apiDone = false, without }: Overrides = {}) {
  const tasks = DEMO_TASK_KEYS.filter((key) => key !== without).map((key) => ({
    id: TASK_IDS[key],
    column: key === "api-endpoint" && apiDone ? "done" : "todo",
    waitsOn:
      key === "write-tests" && !apiDone
        ? [{ id: TASK_IDS["api-endpoint"] }]
        : [],
    subtasks: [],
  }));
  return { tasks, projects: [] } as unknown as BoardResponse;
}
