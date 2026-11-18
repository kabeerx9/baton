import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

/** Answers the deleted workspace's `{ id }`. */
export async function deleteWorkspace(workspaceId: string) {
  const response = await client.workspace[":workspaceId"].$delete({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
