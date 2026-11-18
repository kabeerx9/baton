import { contractRequest } from "./contract-request";

// TODO(p3-api): switch to client type (`DELETE /api/workspace/{id}`).
export function deleteWorkspace(workspaceId: string) {
  return contractRequest<unknown>(
    "DELETE",
    `/workspace/${encodeURIComponent(workspaceId)}`,
  );
}
