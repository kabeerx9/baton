import { DEFAULT_ROLE_NAMES } from "@baton/permissions";
import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceRoleTable, workspaceTable } from "../../database/schema";

async function listWorkspaceRoles(workspaceId: string) {
  const [workspace] = await db
    .select({ id: workspaceTable.id })
    .from(workspaceTable)
    // A demo workspace is its owner's private sandbox: not found here.
    .where(
      and(eq(workspaceTable.id, workspaceId), eq(workspaceTable.kind, "team")),
    )
    .limit(1);
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  const custom = await db
    .select({ role: workspaceRoleTable.role })
    .from(workspaceRoleTable)
    .where(eq(workspaceRoleTable.workspaceId, workspaceId))
    .orderBy(asc(workspaceRoleTable.role));

  return [
    ...new Set([
      ...DEFAULT_ROLE_NAMES,
      ...custom.map((row) => row.role).filter((role) => role !== "owner"),
    ]),
  ];
}

export default listWorkspaceRoles;
