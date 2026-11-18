import { eq } from "drizzle-orm";
import db from "../database";
import { apikeyTable } from "../database/schema";
import { hashApiKey } from "./hash-api-key";

/**
 * Whether `secret` is any stored key, enabled or not. A read only: it never
 * counts as a request against the key's limits.
 */
export async function isStoredApiKey(secret: string): Promise<boolean> {
  const [row] = await db
    .select({ id: apikeyTable.id })
    .from(apikeyTable)
    .where(eq(apikeyTable.key, hashApiKey(secret)))
    .limit(1);
  return Boolean(row);
}
