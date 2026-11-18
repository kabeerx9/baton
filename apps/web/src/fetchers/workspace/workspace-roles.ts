import { contractRequest } from "./contract-request";
import type { WorkspaceRole } from "./types";

const rolesPath = (workspaceId: string) =>
  `/workspace/${encodeURIComponent(workspaceId)}/roles`;

export type WorkspaceRoleBody = {
  role: string;
  permission: Record<string, string[]>;
};

// TODO(p3-api): switch to client type (`GET /api/workspace/{id}/roles`).
export function getWorkspaceRoles(workspaceId: string) {
  return contractRequest<WorkspaceRole[]>("GET", rolesPath(workspaceId));
}

// TODO(p3-api): switch to client type (`POST /api/workspace/{id}/roles`).
export function createWorkspaceRole(
  workspaceId: string,
  body: WorkspaceRoleBody,
) {
  return contractRequest<WorkspaceRole>("POST", rolesPath(workspaceId), body);
}

// TODO(p3-api): switch to client type (`PATCH /api/workspace/{id}/roles/{roleId}`).
export function updateWorkspaceRole(
  workspaceId: string,
  roleId: string,
  body: Partial<WorkspaceRoleBody>,
) {
  return contractRequest<WorkspaceRole>(
    "PATCH",
    `${rolesPath(workspaceId)}/${encodeURIComponent(roleId)}`,
    body,
  );
}

// TODO(p3-api): switch to client type (`DELETE /api/workspace/{id}/roles/{roleId}`).
export function deleteWorkspaceRole(workspaceId: string, roleId: string) {
  return contractRequest<unknown>(
    "DELETE",
    `${rolesPath(workspaceId)}/${encodeURIComponent(roleId)}`,
  );
}
