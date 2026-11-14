import { client } from "@baton/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type AddSubtaskRequest = InferRequestType<
  (typeof client)["board"][":taskId"]["subtask"]["$post"]
>["json"] & { taskId: string };

async function addSubtask({ taskId, ...json }: AddSubtaskRequest) {
  const response = await client.board[":taskId"].subtask.$post({
    param: { taskId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return response.json();
}

export default addSubtask;
