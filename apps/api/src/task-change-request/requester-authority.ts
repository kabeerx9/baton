import { eq } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";
import type { PermissionMap } from "../utils/role-permissions";
import { parsePermissions } from "../utils/verify-api-key";
import type { ChangeRequestRow } from "./response";

/**
 * The scope a requester still holds through the credential they asked with.
 * A session request is limited only by the account (scope null). An API-key
 * request holds the key's current scope, and nothing once the key is
 * disabled, expired, deleted or given to someone else.
 */
export async function requesterScope(
  database: DbOrTx,
  request: Pick<ChangeRequestRow, "authMethod" | "apiKeyId" | "requestedBy">,
): Promise<{ ok: true; scope: PermissionMap | null } | { ok: false }> {
  if (request.authMethod !== "api_key") return { ok: true, scope: null };
  if (!request.apiKeyId) return { ok: false };
  const [key] = await database
    .select({
      enabled: schema.apikeyTable.enabled,
      expiresAt: schema.apikeyTable.expiresAt,
      permissions: schema.apikeyTable.permissions,
      owner: schema.apikeyTable.referenceId,
    })
    .from(schema.apikeyTable)
    .where(eq(schema.apikeyTable.id, request.apiKeyId))
    .limit(1);
  if (
    !key ||
    !key.enabled ||
    (key.expiresAt && key.expiresAt <= new Date()) ||
    key.owner !== request.requestedBy
  )
    return { ok: false };
  return { ok: true, scope: parsePermissions(key.permissions) };
}
