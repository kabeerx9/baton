import { contractRequest } from "./contract-request";

/** One atomic call: the new owner is promoted and the caller becomes admin. */
// TODO(p3-api): switch to client type (`PUT /api/workspace/{id}/owner`).
export function transferWorkspaceOwnership(
  workspaceId: string,
  userId: string,
) {
  return contractRequest<unknown>(
    "PUT",
    `/workspace/${encodeURIComponent(workspaceId)}/owner`,
    { userId },
  );
}
