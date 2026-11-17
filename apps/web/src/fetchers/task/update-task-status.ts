import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";
import type Task from "@/types/task";

type UpdateTaskStatusPayload = Pick<Task, "status">;

/**
 * `signal` puts a deadline on the call (`AbortSignal.timeout`). A timeout
 * rejects with a non-HttpError: the write may still have committed.
 */
async function updateTaskStatus(
  taskId: string,
  task: UpdateTaskStatusPayload,
  signal?: AbortSignal,
) {
  const response = await client.task.status[":id"].$put(
    {
      param: { id: taskId },
      json: {
        status: task.status || "",
      },
    },
    { init: { signal } },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default updateTaskStatus;
