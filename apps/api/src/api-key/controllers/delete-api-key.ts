import { and, eq } from "drizzle-orm";
import db from "../../database";
import { apikeyTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { revokeApiKeyConnections } from "../../ws";

/**
 * Delete one of the caller's keys. Another user's key answers 404, as an
 * unknown id does. Requests with it fail from the commit; its sockets close
 * right after.
 */
async function deleteApiKey(userId: string, id: string) {
  const [deleted] = await db
    .delete(apikeyTable)
    .where(and(eq(apikeyTable.id, id), eq(apikeyTable.referenceId, userId)))
    .returning({ id: apikeyTable.id });
  if (!deleted) {
    throw new ApiError(404, {
      code: "API_KEY_NOT_FOUND",
      message: "API key not found",
    });
  }
  await revokeApiKeyConnections(userId, [deleted.id]);
  return { id: deleted.id };
}

export default deleteApiKey;
