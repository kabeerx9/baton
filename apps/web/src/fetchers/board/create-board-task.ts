import { client } from "@baton/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CreateBoardTaskRequest = InferRequestType<
  (typeof client)["board"]["workspace"][":workspaceId"]["$post"]
>["json"] & { workspaceId: string };

async function createBoardTask({
  workspaceId,
  ...json
}: CreateBoardTaskRequest) {
  const response = await client.board.workspace[":workspaceId"].$post({
    param: { workspaceId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return response.json();
}

export default createBoardTask;
