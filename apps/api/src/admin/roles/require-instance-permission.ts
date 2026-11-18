import type { InstancePermission } from "@baton/permissions";
import type { Context, Next } from "hono";
import { ApiError } from "../../errors/api-error";
import { getUserAccess } from "./get-instance-access";

/** Admin routes run after `requireUserSession`, so the caller is a user. */
export function requireInstancePermission(
  ...permissions: InstancePermission[]
) {
  return async function requirePermission(c: Context, next: Next) {
    const userId = c.get("identity")?.userId;
    // Only a person's session acts here; a key or MCP token never does.
    if (!userId) {
      throw new ApiError(403, {
        message: "A user session is required",
        code: "SESSION_REQUIRED",
      });
    }
    const access = await getUserAccess(userId);
    const missingPermissions = permissions.filter(
      (permission) => !access.permissions.includes(permission),
    );
    if (missingPermissions.length > 0) {
      throw new ApiError(403, {
        code: "INSTANCE_PERMISSION_REQUIRED",
        message: "You don't have permission to do this.",
        missingPermissions,
      });
    }
    return next();
  };
}
