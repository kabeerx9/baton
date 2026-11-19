import { and, eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import db from "../database";
import { userTable, workspaceUserTable } from "../database/schema";
import { logger } from "../observability/logger";

export async function syncWorkspaceAccess(userId: string, ws: WSContext) {
  try {
    const [user] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.id, userId));
    if (!user) {
      ws.close(1008, "User access revoked");
      return;
    }
    // Members only: an instance administrator gets no workspace by role.
    const workspaces = await db
      .select({ workspaceId: workspaceUserTable.workspaceId })
      .from(workspaceUserTable)
      .where(eq(workspaceUserTable.userId, userId));
    ws.send(
      JSON.stringify({
        type: "WORKSPACE_ACCESS_SYNC",
        workspaceIds: workspaces.map((workspace) => workspace.workspaceId),
      }),
    );
  } catch (error) {
    logger.error("Failed to synchronize workspace access", { error });
    ws.close(1011, "Workspace access synchronization failed");
  }
}

/** A member row is the only access; it also implies the user exists. */
export async function hasWorkspaceAccess(userId: string, workspaceId: string) {
  const members = await db
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.userId, userId),
        eq(workspaceUserTable.workspaceId, workspaceId),
      ),
    );
  return members.length > 0;
}
