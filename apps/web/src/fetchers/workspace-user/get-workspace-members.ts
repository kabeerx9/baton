import { client } from "@baton/libs";
import type { WorkspaceMember } from "@/fetchers/workspace/types";
import { HttpError } from "@/lib/http-error";

/** Every member of the workspace, in the flat API shape. */
async function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const response = await client.workspace[":workspaceId"].members.$get({
    param: { workspaceId },
    query: {},
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default getWorkspaceMembers;
