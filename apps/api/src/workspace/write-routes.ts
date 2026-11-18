import { createRoute, errorResponse, jsonResponse } from "../openapi";
import { requireMemberPermission } from "../utils/require-member-permission";
import { requireApiKeyScope } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { refuseMcpToken } from "./write/refuse-mcp-token";
import {
  deletedIdSchema,
  leftWorkspaceSchema,
  workspaceMemberListSchema,
  workspaceSchema,
} from "./response";
import {
  createWorkspaceBody,
  transferOwnershipBody,
  updateMemberRoleBody,
  updateWorkspaceBody,
  workspaceIdParam,
  workspaceMemberParam,
} from "./schema";

const json = <T>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const WHO =
  " Requires a membership row; an instance administrator who is not a member gets 403 MEMBERSHIP_REQUIRED and uses /api/admin. Agent (MCP) tokens get 403 MCP_TOKEN_NOT_ALLOWED. The permission is checked again under the workspace lock.";

export const createWorkspaceRoute = createRoute({
  method: "post",
  operationId: "createWorkspace",
  path: "/",
  tags: ["Workspaces"],
  summary: "Create workspace",
  description:
    "Create a team workspace with the caller as its owner and the default viewer, member and admin roles, in one transaction. The server makes the slug from the name. When workspace creation is restricted, only instance administrators may create. A scoped API key needs workspace:manage_settings; agent (MCP) tokens are refused.",
  middleware: [
    refuseMcpToken,
    requireApiKeyScope({ workspace: ["manage_settings"] }),
  ] as const,
  request: { body: json(createWorkspaceBody) },
  responses: {
    201: jsonResponse("The new workspace, with role owner", workspaceSchema),
    400: errorResponse("Invalid name (code INVALID_WORKSPACE_NAME)"),
    403: errorResponse(
      "Creation is restricted (WORKSPACE_CREATION_RESTRICTED), the account is deactivated, the API key lacks workspace:manage_settings, or an agent token was used",
    ),
  },
});

export const updateWorkspaceRoute = createRoute({
  method: "patch",
  operationId: "updateWorkspace",
  path: "/{workspaceId}",
  tags: ["Workspaces"],
  summary: "Update workspace",
  description: `Change the workspace name, description or logo. Needs organization:update.${WHO}`,
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireMemberPermission({ organization: ["update"] }),
  ] as const,
  request: { params: workspaceIdParam, body: json(updateWorkspaceBody) },
  responses: {
    200: jsonResponse("The updated workspace", workspaceSchema),
    400: errorResponse("Invalid name"),
    403: errorResponse(
      "Missing organization:update, not a member, archived workspace, or an agent token",
    ),
    404: errorResponse("Workspace not found"),
  },
});

export const deleteWorkspaceRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkspace",
  path: "/{workspaceId}",
  tags: ["Workspaces"],
  summary: "Delete workspace",
  description: `Permanently delete the workspace and everything in it. Needs organization:delete. The owner of a tour (demo) workspace may delete it.${WHO}`,
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireMemberPermission({ organization: ["delete"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("The deleted workspace's id", deletedIdSchema),
    403: errorResponse("Missing organization:delete, or not a member"),
    404: errorResponse("Workspace not found"),
  },
});

export const leaveWorkspaceRoute = createRoute({
  method: "post",
  operationId: "leaveWorkspace",
  path: "/{workspaceId}/leave",
  tags: ["Workspaces"],
  summary: "Leave workspace",
  description:
    "The caller leaves the workspace. The only owner can't leave (409); transfer ownership first. A scoped API key needs workspace:manage_settings; agent (MCP) tokens are refused.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireMemberPermission(
      {},
      { apiKeyScope: { workspace: ["manage_settings"] } },
    ),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("The workspace left", leftWorkspaceSchema),
    403: errorResponse("Not a member, API key scope, or an agent token"),
    404: errorResponse("Workspace not found"),
    409: errorResponse("The caller is the only owner (code ONLY_OWNER)"),
  },
});

export const removeWorkspaceMemberRoute = createRoute({
  method: "delete",
  operationId: "removeWorkspaceMember",
  path: "/{workspaceId}/members/{userId}",
  tags: ["Workspaces"],
  summary: "Remove workspace member",
  description: `Remove a member. Needs member:delete; only an owner removes an owner, and the only owner can't be removed. A join link made before the removal refuses them. Refused on a tour workspace (DEMO_WORKSPACE).${WHO}`,
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireMemberPermission({ member: ["delete"] }),
  ] as const,
  request: { params: workspaceMemberParam },
  responses: {
    200: jsonResponse(
      "The members after the removal",
      workspaceMemberListSchema,
    ),
    403: errorResponse(
      "Missing member:delete, a non-owner acting on an owner (OWNER_REQUIRED), or a tour workspace",
    ),
    404: errorResponse("Workspace or member not found"),
    409: errorResponse("The member is the only owner (code ONLY_OWNER)"),
  },
});

export const updateWorkspaceMemberRoleRoute = createRoute({
  method: "put",
  operationId: "updateWorkspaceMemberRole",
  path: "/{workspaceId}/members/{userId}/role",
  tags: ["Workspaces"],
  summary: "Change a member's role",
  description: `Give a member another role. Needs member:update; only an owner changes an owner's role. owner is refused: use the ownership transfer. Refused on a tour workspace.${WHO}`,
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireMemberPermission({ member: ["update"] }),
  ] as const,
  request: { params: workspaceMemberParam, body: json(updateMemberRoleBody) },
  responses: {
    200: jsonResponse(
      "The members after the change",
      workspaceMemberListSchema,
    ),
    400: errorResponse("Unknown role, or owner (code UNKNOWN_ROLE)"),
    403: errorResponse("Missing member:update, or OWNER_REQUIRED"),
    404: errorResponse("Workspace or member not found"),
    409: errorResponse("The member is the only owner (code ONLY_OWNER)"),
  },
});

export const transferWorkspaceOwnershipRoute = createRoute({
  method: "put",
  operationId: "transferWorkspaceOwnership",
  path: "/{workspaceId}/owner",
  tags: ["Workspaces"],
  summary: "Transfer workspace ownership",
  description: `The caller, an owner, makes another member an owner and becomes an admin, in one transaction. The new owner's project limits are cleared. A scoped API key needs member:update. Refused on a tour workspace.${WHO}`,
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireMemberPermission({}, { apiKeyScope: { member: ["update"] } }),
  ] as const,
  request: { params: workspaceIdParam, body: json(transferOwnershipBody) },
  responses: {
    200: jsonResponse(
      "The members after the transfer",
      workspaceMemberListSchema,
    ),
    400: errorResponse("The caller named themselves (code ALREADY_OWNER)"),
    403: errorResponse("The caller is not an owner (code OWNER_REQUIRED)"),
    404: errorResponse("Workspace or member not found"),
  },
});
