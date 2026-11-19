import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export type CreateCommentRequest = { taskId: string; comment: string };

async function createComment({ taskId, comment }: CreateCommentRequest) {
  const response = await client.comment[":taskId"].$post({
    param: { taskId },
    json: { content: comment },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createComment;
