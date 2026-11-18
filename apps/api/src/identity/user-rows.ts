import { eq, sql } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";
import type { IdentityProvider } from "./port";

const { userTable } = schema;

/**
 * The identity fields live on Baton's `user` row for every adapter here, so
 * these writes commit or roll back with the caller's transaction.
 */
export const userRows: IdentityProvider["users"] = {
  async create(tx: DbOrTx, { name, email }) {
    const [existing] = await tx
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(sql`lower(${userTable.email})`, email.toLowerCase()))
      .limit(1);
    if (existing) return null;
    const [created] = await tx
      .insert(userTable)
      .values({ name, email, emailVerified: false })
      .onConflictDoNothing({ target: userTable.email })
      .returning({ id: userTable.id });
    return created ? { userId: created.id } : null;
  },
  async update(tx: DbOrTx, userId, patch) {
    const set = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(set).length === 0) return;
    await tx.update(userTable).set(set).where(eq(userTable.id, userId));
  },
};
