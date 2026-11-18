import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

const member = client.workspace[":workspaceId"].members[":userId"];

/** Answers the updated member list. */
export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
) {
  const response = await member.$delete({ param: { workspaceId, userId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** `owner` is refused here; ownership moves only by transfer. */
export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: string,
) {
  const response = await member.role.$put({
    param: { workspaceId, userId },
    json: { role },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
