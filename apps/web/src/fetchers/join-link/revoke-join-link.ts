import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export async function revokeJoinLink(workspaceId: string): Promise<null> {
  const response = await client["join-link"].workspace[":workspaceId"].$delete({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return null;
}
