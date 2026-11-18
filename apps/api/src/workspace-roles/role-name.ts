import { and, eq } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";
import {
  invalidRoleNameError,
  reservedRoleNameError,
  roleNameTakenError,
} from "./role-errors";
import { normalizeRoleName, RESERVED_ROLE_NAMES } from "./role-rules";

/** A new name for a role: valid, not reserved, not taken in this workspace. */
export async function assertNewRoleName(
  tx: DbOrTx,
  workspaceId: string,
  raw: string,
) {
  const name = normalizeRoleName(raw);
  if (!name || name.length > 64 || name.includes(","))
    throw invalidRoleNameError();
  if (RESERVED_ROLE_NAMES.includes(name)) throw reservedRoleNameError();
  const [taken] = await tx
    .select({ id: schema.workspaceRoleTable.id })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        eq(schema.workspaceRoleTable.workspaceId, workspaceId),
        eq(schema.workspaceRoleTable.role, name),
      ),
    )
    .limit(1);
  if (taken) throw roleNameTakenError();
  return name;
}
