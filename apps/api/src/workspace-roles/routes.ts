import { createRoute, errorResponse, jsonResponse } from "../openapi";
import { requireMemberPermission } from "../utils/require-member-permission";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  deletedIdSchema,
  workspaceRoleListSchema,
  workspaceRoleSchema,
} from "../workspace/response";
import {
  createWorkspaceRoleBody,
  updateWorkspaceRoleBody,
  workspaceIdParam,
  workspaceRoleParam,
} from "../workspace/schema";

const json = <T>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const RULES =
  " A role may grant only permissions the caller holds. Refused on a tour workspace (DEMO_WORKSPACE). Needs a membership row; agent (MCP) tokens are refused.";

export const listWorkspaceRolesRoute = createRoute({
  method: "get",
  operationId: "listWorkspaceRoles",
  path: "/{workspaceId}/roles",
  tags: ["Workspaces"],
  summary: "List workspace roles",
  description:
    "The workspace's stored roles: the seeded viewer, member and admin and its custom roles, with their permissions. owner is built in and not listed. Needs role:read.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ role: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("The workspace's roles", workspaceRoleListSchema),
    403: errorResponse("Missing role:read"),
    404: errorResponse("Workspace not found"),
  },
});

export const createWorkspaceRoleRoute = createRoute({
  method: "post",
  operationId: "createWorkspaceRole",
  path: "/{workspaceId}/roles",
  tags: ["Workspaces"],
  summary: "Create workspace role",
  description: `Add a custom role. Needs role:create. At most 25 roles per workspace; owner, admin, member and viewer are reserved names.${RULES}`,
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireMemberPermission({ role: ["create"] }),
  ] as const,
  request: { params: workspaceIdParam, body: json(createWorkspaceRoleBody) },
  responses: {
    201: jsonResponse("The new role", workspaceRoleSchema),
    400: errorResponse(
      "Reserved name, invalid name, unknown permission, or the 25-role limit",
    ),
    403: errorResponse(
      "Missing role:create, or the role grants more than the caller holds",
    ),
    404: errorResponse("Workspace not found"),
    409: errorResponse("The name is taken (code ROLE_NAME_TAKEN)"),
  },
});

export const updateWorkspaceRoleRoute = createRoute({
  method: "patch",
  operationId: "updateWorkspaceRole",
  path: "/{workspaceId}/roles/{roleId}",
  tags: ["Workspaces"],
  summary: "Update workspace role",
  description: `Change a role's permissions or name. Needs role:update. A built-in role can't be renamed (DEFAULT_ROLE); a role members hold can't be renamed (ROLE_IN_USE).${RULES}`,
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireMemberPermission({ role: ["update"] }),
  ] as const,
  request: { params: workspaceRoleParam, body: json(updateWorkspaceRoleBody) },
  responses: {
    200: jsonResponse("The updated role", workspaceRoleSchema),
    400: errorResponse(
      "Reserved or invalid name, unknown permission, or DEFAULT_ROLE",
    ),
    403: errorResponse(
      "Missing role:update, or the role grants more than the caller holds",
    ),
    404: errorResponse("Workspace or role not found"),
    409: errorResponse("The name is taken, or members hold the role"),
  },
});

export const deleteWorkspaceRoleRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkspaceRole",
  path: "/{workspaceId}/roles/{roleId}",
  tags: ["Workspaces"],
  summary: "Delete workspace role",
  description: `Delete a custom role. Needs role:delete. A built-in role can't be deleted (400 DEFAULT_ROLE); a role members hold can't be deleted (409 ROLE_IN_USE).${RULES}`,
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireMemberPermission({ role: ["delete"] }),
  ] as const,
  request: { params: workspaceRoleParam },
  responses: {
    200: jsonResponse("The deleted role's id", deletedIdSchema),
    400: errorResponse("A built-in role (code DEFAULT_ROLE)"),
    403: errorResponse("Missing role:delete"),
    404: errorResponse("Workspace or role not found"),
    409: errorResponse("Members hold the role (code ROLE_IN_USE)"),
  },
});
