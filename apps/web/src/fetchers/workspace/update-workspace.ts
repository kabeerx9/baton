import { client } from "@baton/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type UpdateWorkspaceBody = InferRequestType<
  (typeof client.workspace)[":workspaceId"]["$patch"]
>["json"];

export async function updateWorkspace(
  workspaceId: string,
  json: UpdateWorkspaceBody,
) {
  const response = await client.workspace[":workspaceId"].$patch({
    param: { workspaceId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
