import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

/**
 * Whether the server lets the caller answer the task's pending request. The
 * API owns this rule (creator, assignee, owner or admin, with the action's
 * permission), so the client asks instead of working it out.
 */
async function canAnswerChangeRequest(workspaceId: string, taskId: string) {
  const response = await client["task-change-request"].$get({
    query: {
      workspaceId,
      taskId,
      canAnswer: "me",
      state: "pending",
      limit: "1",
      offset: "0",
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const { requests } = await response.json();
  return requests.map((request) => request.id);
}

export default canAnswerChangeRequest;
