import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

async function getTeamHistory(workspaceId: string, days: number) {
  const response = await client.board.workspace[":workspaceId"].history.$get({
    param: { workspaceId },
    query: { days: String(days) },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return response.json();
}

export type TeamHistoryResponse = Awaited<ReturnType<typeof getTeamHistory>>;

export default getTeamHistory;
