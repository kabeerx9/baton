import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";
import type { CreateJoinLinkInput, JoinLink } from "./types";

/** Replaces the current link. The response always carries the URL. */
export async function createJoinLink(
  workspaceId: string,
  input: CreateJoinLinkInput,
): Promise<JoinLink> {
  const response = await client["join-link"].workspace[":workspaceId"].$post({
    param: { workspaceId },
    json: input,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return (await response.json()).link;
}
