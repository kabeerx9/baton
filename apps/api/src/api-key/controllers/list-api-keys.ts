import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { apikeyTable } from "../../database/schema";
import { toApiKeyView } from "../to-api-key-view";

/** The caller's own keys, newest first. */
async function listApiKeys(userId: string) {
  const rows = await db
    .select()
    .from(apikeyTable)
    .where(eq(apikeyTable.referenceId, userId))
    .orderBy(desc(apikeyTable.createdAt), desc(apikeyTable.id));
  return rows.map(toApiKeyView);
}

export default listApiKeys;
