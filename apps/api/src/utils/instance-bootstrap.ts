import { asc, count, eq, sql } from "drizzle-orm";
import db, { schema } from "../database";
import { instanceAdminRoleSql } from "./instance-admin-role";

export async function hasRegisteredUsers(): Promise<boolean> {
  const [row] = await db.select({ value: count() }).from(schema.userTable);
  return (row?.value ?? 0) > 0;
}

export async function promoteInitialAdministrator(
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(2026)`);
    const [admin] = await tx
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .where(instanceAdminRoleSql(schema.userTable.role))
      .limit(1);
    if (admin) return;

    // Elect the earliest registered user, not the only row: concurrent first
    // signups may both be inserted before either after-hook gets this lock.
    // Existing non-admin accounts remain ineligible for promotion by a later
    // signup.
    const [first] = await tx
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .orderBy(asc(schema.userTable.createdAt), asc(schema.userTable.id))
      .limit(1);
    if (first?.id !== userId) return;
    await tx
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, userId));
  });
}
