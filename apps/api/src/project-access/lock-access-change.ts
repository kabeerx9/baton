import { and, eq, inArray } from "drizzle-orm";
import { schema } from "../database";
import { roleHasWorkspacePermission } from "../utils/require-workspace-permission";
import type { DbOrTx } from "./db-or-tx";

export async function lockAccessChange(
  database: DbOrTx,
  change: { workspaceId: string; actorId: string; userId: string },
): Promise<{ actorAllowed: boolean; targetRole: string | null }> {
  const rows = await database
    .select({
      userId: schema.workspaceUserTable.userId,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, change.workspaceId),
        inArray(schema.workspaceUserTable.userId, [
          change.actorId,
          change.userId,
        ]),
      ),
    )
    .orderBy(schema.workspaceUserTable.id)
    .for("update");
  const roles = new Map(rows.map((row) => [row.userId, row.role]));
  const actorRole = roles.get(change.actorId);

  if (
    actorRole &&
    (await roleHasWorkspacePermission(
      change.workspaceId,
      actorRole,
      { member: ["update"] },
      database,
    ))
  ) {
    return { actorAllowed: true, targetRole: roles.get(change.userId) ?? null };
  }

  // Only a member with member:update; instance administrators get no bypass.
  return { actorAllowed: false, targetRole: roles.get(change.userId) ?? null };
}
