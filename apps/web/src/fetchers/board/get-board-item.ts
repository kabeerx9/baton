import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

/**
 * One board item by task id or key, with no done window: the task itself or
 * the feature that holds it. `task` is null for a repo task outside any feature.
 */
async function getBoardItem(workspaceId: string, key: string) {
  const response = await client.board.workspace[":workspaceId"].item[
    ":key"
  ].$get({ param: { workspaceId, key } });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return response.json();
}

export type BoardItemResponse = Awaited<ReturnType<typeof getBoardItem>>;

export default getBoardItem;
