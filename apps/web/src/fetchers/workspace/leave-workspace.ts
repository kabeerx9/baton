import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

/** The caller leaves; answers `{ workspaceId }`. */
export async function leaveWorkspace(workspaceId: string) {
  const response = await client.workspace[":workspaceId"].leave.$post({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
