import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";
import type { JoinLinkPreview } from "./types";

/** Public. Always 200 for a well-formed call; the body says if the link works. */
export async function previewJoinLink(token: string): Promise<JoinLinkPreview> {
  const response = await client["join-link"].preview.$post({ json: { token } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
