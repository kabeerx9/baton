import { contractRequest } from "@/fetchers/workspace/contract-request";

const memberPath = (workspaceId: string, userId: string) =>
  `/workspace/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`;

// TODO(p3-api): switch to client type (`DELETE /api/workspace/{id}/members/{userId}`).
export function removeWorkspaceMember(workspaceId: string, userId: string) {
  return contractRequest<unknown>("DELETE", memberPath(workspaceId, userId));
}

/** `owner` is refused here; ownership moves only by transfer. */
// TODO(p3-api): switch to client type (`PUT /api/workspace/{id}/members/{userId}/role`).
export function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: string,
) {
  return contractRequest<unknown>(
    "PUT",
    `${memberPath(workspaceId, userId)}/role`,
    { role },
  );
}
