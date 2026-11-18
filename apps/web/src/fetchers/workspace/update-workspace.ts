import { contractRequest } from "./contract-request";
import type { Workspace } from "./types";

export type UpdateWorkspaceBody = {
  name?: string;
  description?: string;
  logo?: string;
};

// TODO(p3-api): switch to client type (`PATCH /api/workspace/{id}`).
export function updateWorkspace(
  workspaceId: string,
  body: UpdateWorkspaceBody,
) {
  return contractRequest<Workspace>(
    "PATCH",
    `/workspace/${encodeURIComponent(workspaceId)}`,
    body,
  );
}
