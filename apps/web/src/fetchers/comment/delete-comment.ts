import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export type DeleteCommentRequest = { activityId: string };

async function deleteComment({ activityId }: DeleteCommentRequest) {
  const response = await client.comment[":id"].$delete({
    param: { id: activityId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default deleteComment;
