import { eq } from "drizzle-orm";
import createApiKey from "../../../apps/api/src/api-key/controllers/create-api-key";
import db, { schema } from "../../../apps/api/src/database";

type ServerOnly = {
  permissions?: Record<string, string[]> | null;
  rateLimitEnabled?: boolean;
  rateLimitMax?: number;
  rateLimitTimeWindow?: number;
  remaining?: number | null;
  refillAmount?: number | null;
  refillInterval?: number | null;
};

/**
 * A key made by Baton's create controller, as `POST /api/api-key` makes it,
 * then given the fields no client may set (scope, limits). Replaces the
 * plugin's server-side `auth.api.createApiKey` in tests.
 */
export async function createTestApiKey({
  userId,
  name,
  prefix,
  expiresIn,
  metadata,
  ...serverOnly
}: {
  userId: string;
  name?: string;
  prefix?: string;
  expiresIn?: number;
  metadata?: Record<string, unknown>;
} & ServerOnly) {
  const created = await createApiKey(userId, {
    name,
    prefix,
    expiresIn,
    metadata,
  });
  const { permissions, ...limits } = serverOnly;
  const update = {
    ...limits,
    ...(permissions !== undefined
      ? {
          permissions:
            permissions === null ? null : JSON.stringify(permissions),
        }
      : {}),
  };
  if (Object.keys(update).length > 0) {
    await db
      .update(schema.apikeyTable)
      .set(update)
      .where(eq(schema.apikeyTable.id, created.id));
  }
  return created;
}
