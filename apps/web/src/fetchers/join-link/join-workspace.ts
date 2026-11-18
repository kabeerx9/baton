import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";
import type { JoinWorkspaceResult } from "./types";

/** Failures carry `HttpError.code`, e.g. JOIN_LINK_EXPIRED or REMOVED_FROM_WORKSPACE. */
export async function joinWorkspace(
  token: string,
): Promise<JoinWorkspaceResult> {
  const response = await client["join-link"].join.$post({ json: { token } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
