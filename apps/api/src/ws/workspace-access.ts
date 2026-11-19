import { and, eq, or } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import db from "../database";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../database/schema";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import { logger } from "../observability/logger";

export async function syncWorkspaceAccess(userId: string, ws: WSContext) {
  try {
    const [user] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId));
    if (!user) {
      ws.close(1008, "User access revoked");
      return;
    }
    // Administrators need an existing-workspace snapshot too: an unrestricted
    // marker cannot remove a workspace deleted while their socket was offline.
    const workspaces = hasInstanceAdminRole(user.role)
      ? await db
          .select({ workspaceId: workspaceTable.id })
          .from(workspaceTable)
          // A demo workspace is members only; the admin's own demo comes
          // through the membership below.
          .where(
            or(
              eq(workspaceTable.kind, "team"),
              eq(workspaceTable.demoOwnerUserId, userId),
            ),
          )
      : await db
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

export async function hasWorkspaceAccess(userId: string, workspaceId: string) {
  const [[user], members] = await Promise.all([
    db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId)),
    db
      .select({ userId: workspaceUserTable.userId })
      .from(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.userId, userId),
          eq(workspaceUserTable.workspaceId, workspaceId),
        ),
      ),
  ]);
  if (!user) return false;
  if (members.length > 0) return true;
  if (!hasInstanceAdminRole(user.role)) return false;
  // Administrators reach team workspaces only; a demo is members only.
  const [workspace] = await db
    .select({ kind: workspaceTable.kind })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId));
  return workspace?.kind === "team";
}
