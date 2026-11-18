import { and, eq } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";
import { roleNotFoundError } from "./role-errors";

/** The role row, re-read under the workspace lock. */
export async function findLockedRole(
  tx: DbOrTx,
  workspaceId: string,
  roleId: string,
) {
  const [role] = await tx
    .select()
    .from(schema.workspaceRoleTable)
    .where(
      and(
        eq(schema.workspaceRoleTable.workspaceId, workspaceId),
        eq(schema.workspaceRoleTable.id, roleId),
      ),
    )
    .limit(1)
    .for("update");
  if (!role) throw roleNotFoundError();
  return role;
}
