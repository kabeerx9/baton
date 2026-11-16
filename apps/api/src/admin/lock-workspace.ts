import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "../database";
import { ApiError } from "../errors/api-error";
import type { DbOrTx } from "../project-access/db-or-tx";
import {
  DEMO_WORKSPACE_CODE,
  DEMO_WORKSPACE_MESSAGE,
} from "../workspace/kind/assert-shareable-workspace";

export async function lockWorkspace(database: DbOrTx, workspaceId: string) {
  const [workspace] = await database
    .select({ id: schema.workspaceTable.id, kind: schema.workspaceTable.kind })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspaceId))
    .for("update");
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }
  // A tour workspace keeps exactly one member, its owner.
  if (workspace.kind !== "team") {
    throw new ApiError(403, {
      code: DEMO_WORKSPACE_CODE,
      message: DEMO_WORKSPACE_MESSAGE,
    });
  }

  return database
    .select({
      userId: schema.workspaceUserTable.userId,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(eq(schema.workspaceUserTable.workspaceId, workspaceId))
    .orderBy(schema.workspaceUserTable.id)
    .for("update");
}
