import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import { ApiError } from "../errors/api-error";
import { membershipRequiredError } from "../workspace/write/write-errors";
import { missingPermissions } from "./missing-permissions";
import { roleHasWorkspacePermission } from "./require-workspace-permission";
import { type PermissionMap, satisfies } from "./role-permissions";

export const mcpTokenNotAllowedError = () =>
  new ApiError(403, {
    code: "MCP_TOKEN_NOT_ALLOWED",
    message: "An agent token cannot change workspaces or members.",
  });

/**
 * Fast reject for the member write routes, after `workspaceAccess` set
 * `workspaceId`. A membership row is required and the stored role decides:
 * no instance-admin bypass. The controller decides again under the
 * workspace lock (`authorizeWorkspaceWrite`); nothing here is passed on.
 */
export function requireMemberPermission(
  permissions: PermissionMap,
  { apiKeyScope = permissions }: { apiKeyScope?: PermissionMap } = {},
) {
  return async (c: Context, next: Next) => {
    if (c.get("authMethod") === "mcp") throw mcpTokenNotAllowedError();
    const workspaceId = c.get("workspaceId") as string | undefined;
    const userId = c.get("userId") as string | undefined;
    if (!workspaceId)
      throw new HTTPException(500, { message: "workspaceId not set" });
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });

    const scope = (
      c.get("apiKey") as { permissions?: PermissionMap | null } | undefined
    )?.permissions;
    if (scope && !satisfies(scope, apiKeyScope))
      throw new ApiError(403, {
        code: "API_KEY_SCOPE",
        message: "Insufficient API key scope",
        missingPermissions: missingPermissions(scope, apiKeyScope),
      });

    const [member] = await db
      .select({ role: schema.workspaceUserTable.role })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, workspaceId),
          eq(schema.workspaceUserTable.userId, userId),
        ),
      )
      .limit(1);
    if (!member) throw membershipRequiredError();
    if (
      !(await roleHasWorkspacePermission(workspaceId, member.role, permissions))
    )
      throw new ApiError(403, {
        code: "MISSING_PERMISSION",
        message: "Insufficient permissions",
      });
    return next();
  };
}
