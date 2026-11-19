import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export type UpdateCommentRequest = { activityId: string; comment: string };

async function updateComment({ activityId, comment }: UpdateCommentRequest) {
  const response = await client.comment[":id"].$put({
    param: { id: activityId },
    json: { content: comment },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateComment;
