import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";
import type { JoinLink } from "./types";

export async function getJoinLink(
  workspaceId: string,
): Promise<JoinLink | null> {
  const response = await client["join-link"].workspace[":workspaceId"].$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return (await response.json()).link;
}
