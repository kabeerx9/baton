import type { BoardResponse } from "@/fetchers/board/get-board";
import { DEMO_TASK_KEYS, type DemoTaskKey } from "@/fetchers/tour/types";
import { HttpError } from "@/lib/http-error";

/** What the tour reads from the board cache. The only place that reads it. */
export type DemoSnapshot =
  | { status: "pending" }
  /** The demo workspace is gone (deleted, or the user lost access). */
  | { status: "gone" }
  | {
      status: "ready";
      /** A demo task the tour needs is no longer on the board. */
      missing: boolean;
      apiEndpointDone: boolean;
      /** `write-tests` has no open blocker left. */
      writeTestsUnblocked: boolean;
    };

type BoardItem = BoardResponse["tasks"][number];

function findTask(data: BoardResponse, id: string): BoardItem | undefined {
  return data.tasks.find((task) => task.id === id);
}

export function deriveDemoSnapshot(
  query: { data: BoardResponse | undefined; error: unknown },
  taskIds: Record<DemoTaskKey, string>,
): DemoSnapshot {
  if (query.error instanceof HttpError) {
    if (query.error.status === 403 || query.error.status === 404) {
      return { status: "gone" };
    }
  }
  const { data } = query;
  if (!data) return { status: "pending" };

  const tasks = DEMO_TASK_KEYS.map((key) => findTask(data, taskIds[key]));
  const apiEndpoint = findTask(data, taskIds["api-endpoint"]);
  const writeTests = findTask(data, taskIds["write-tests"]);
  return {
    status: "ready",
    missing: tasks.some((task) => task === undefined),
    apiEndpointDone: apiEndpoint?.column === "done",
    writeTestsUnblocked:
      writeTests !== undefined && writeTests.waitsOn.length === 0,
  };
}
