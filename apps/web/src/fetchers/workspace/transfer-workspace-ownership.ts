import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

/** One atomic call; answers the updated member list. */
export async function transferWorkspaceOwnership(
  workspaceId: string,
  userId: string,
) {
  const response = await client.workspace[":workspaceId"].owner.$put({
    param: { workspaceId },
    json: { userId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
