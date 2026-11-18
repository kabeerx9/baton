import { eq } from "drizzle-orm";
import { schema } from "../../database";
import { ApiError } from "../../errors/api-error";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { missingPermissions } from "../../utils/missing-permissions";
import { mcpTokenNotAllowedError } from "../../utils/require-member-permission";
import { roleHasWorkspacePermission } from "../../utils/require-workspace-permission";
import { type PermissionMap, satisfies } from "../../utils/role-permissions";
import { isBanActive } from "../../utils/user-ban";
import { parsePermissions } from "../../utils/verify-api-key";
import { workspaceArchivedError } from "../archive/workspace-archived-error";
import { demoWorkspaceError } from "../kind/refuse-demo-workspace";
import type {
  LockedMember,
  LockedWorkspace,
} from "../lifecycle/lock-workspace";
import type { WorkspaceActor } from "./workspace-actor";
import { membershipRequiredError } from "./write-errors";

export type WriteRule = {
  /** What the actor's stored role must grant. */
  permissions: PermissionMap;
  /** What an API key's scope must cover; defaults to `permissions`. */
  apiKeyScope?: PermissionMap;
  /** Refuse the write on a demo workspace (member, owner and role families). */
  refuseDemo?: boolean;
};

const credentialRevoked = () =>
  new ApiError(403, {
    code: "CREDENTIAL_REVOKED",
    message: "This API key is no longer valid.",
  });

/**
 * The authorization a workspace mutation acts on, read inside its
 * transaction after `lockWorkspace`. The route middleware is only a fast
 * reject; nothing it decided is trusted here. Returns the actor's member row,
 * or null for an instance administrator on `/api/admin/*`.
 *
 * Ban and key rows are plain reads, not locks (auth-boundary §3 difference
 * 10): a revoke or ban that commits before this read refuses the write.
 */
export async function authorizeWorkspaceWrite(
  tx: DbOrTx,
  locked: LockedWorkspace,
  actor: WorkspaceActor,
  rule: WriteRule,
): Promise<LockedMember | null> {
  const { workspace, members } = locked;
  if (actor.kind === "instance_admin") return null;

  const member = members.find((row) => row.userId === actor.userId);
  if (!member) throw membershipRequiredError();
  if (workspace.archivedAt) throw workspaceArchivedError();

  const [user] = await tx
    .select({
      banned: schema.userTable.banned,
      banExpires: schema.userTable.banExpires,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, actor.userId))
    .limit(1);
  if (!user || isBanActive(user))
    throw new ApiError(403, {
      code: "ACCOUNT_DISABLED",
      message: "This account is deactivated.",
    });

  if (actor.authMethod === "mcp") throw mcpTokenNotAllowedError();

  if (actor.authMethod === "api_key") {
    if (!actor.apiKeyId) throw credentialRevoked();
    const [key] = await tx
      .select({
        enabled: schema.apikeyTable.enabled,
        expiresAt: schema.apikeyTable.expiresAt,
        permissions: schema.apikeyTable.permissions,
        owner: schema.apikeyTable.referenceId,
      })
      .from(schema.apikeyTable)
      .where(eq(schema.apikeyTable.id, actor.apiKeyId))
      .limit(1);
    if (
      !key ||
      !key.enabled ||
      (key.expiresAt && key.expiresAt <= new Date()) ||
      key.owner !== actor.userId
    )
      throw credentialRevoked();
    const scope = parsePermissions(key.permissions);
    const required = rule.apiKeyScope ?? rule.permissions;
    if (scope && !satisfies(scope, required))
      throw new ApiError(403, {
        code: "API_KEY_SCOPE",
        message: "Insufficient API key scope",
        missingPermissions: missingPermissions(scope, required),
      });
  }

  if (
    !(await roleHasWorkspacePermission(
      workspace.id,
      member.role,
      rule.permissions,
      tx,
    ))
  )
    throw new ApiError(403, {
      code: "MISSING_PERMISSION",
      message: "Insufficient permissions",
    });

  if (rule.refuseDemo && workspace.kind !== "team") throw demoWorkspaceError();
  return member;
}
