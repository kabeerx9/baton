import { asc, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { toRoleResponse } from "../role-response";

async function listWorkspaceRoles(workspaceId: string) {
  const rows = await db
    .select()
    .from(schema.workspaceRoleTable)
    .where(eq(schema.workspaceRoleTable.workspaceId, workspaceId))
    .orderBy(
      asc(schema.workspaceRoleTable.createdAt),
      asc(schema.workspaceRoleTable.id),
    );
  return rows.map(toRoleResponse);
}

export default listWorkspaceRoles;
