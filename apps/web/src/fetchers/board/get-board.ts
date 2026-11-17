import { client } from "@baton/libs";
import { doneSince } from "@/components/board/done-window";
import { HttpError } from "@/lib/http-error";

/** The board, with done work from the last `DONE_WINDOW_DAYS` local days. */
async function getBoard(workspaceId: string) {
  const response = await client.board.workspace[":workspaceId"].$get({
    param: { workspaceId },
    query: { doneSince: doneSince() },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return response.json();
}

export type BoardResponse = Awaited<ReturnType<typeof getBoard>>;

export default getBoard;
