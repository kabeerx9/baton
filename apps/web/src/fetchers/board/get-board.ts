import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

async function getBoard(workspaceId: string) {
  const response = await client.board.workspace[":workspaceId"].$get({
    param: { workspaceId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return response.json();
}

export type BoardResponse = Awaited<ReturnType<typeof getBoard>>;

export default getBoard;
