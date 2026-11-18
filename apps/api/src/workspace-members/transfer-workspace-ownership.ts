import { and, eq, inArray } from "drizzle-orm";
import db from "../database";
import { workspaceUserTable } from "../database/schema";
import { ApiError } from "../errors/api-error";
import { publishEvent } from "../events";
import { recordWorkspaceMemberAction } from "../admin/audit/record-workspace-member-action";
import { clearMemberProjectAccess } from "../project-access/clear-member-project-access";
import { isOwnerRole } from "../project-access/is-owner-role";
import { lockWorkspace } from "../workspace/lifecycle/lock-workspace";
import { authorizeWorkspaceWrite } from "../workspace/write/authorize-workspace-write";
import type { WorkspaceActor } from "../workspace/write/workspace-actor";
import {
  memberNotFoundError,
  ownerRequiredError,
} from "../workspace/write/write-errors";

/**
 * Make `userId` an owner in one transaction. A member owner hands over:
 * they become admin. An instance administrator makes the target the only
 * owner: every other owner becomes admin. Promotion clears the new owner's
 * project access in the same transaction (auth-boundary §3 difference 4).
 */
export async function transferWorkspaceOwnership(input: {
  workspaceId: string;
  userId: string;
  actor: WorkspaceActor;
}) {
  const { workspaceId, userId, actor } = input;
  await db.transaction(async (tx) => {
    const locked = await lockWorkspace(tx, workspaceId, {
      allowDemo: actor.kind === "member",
    });
    const actorMember = await authorizeWorkspaceWrite(tx, locked, actor, {
      permissions: {},
      apiKeyScope: { member: ["update"] },
      refuseDemo: true,
    });
    if (actorMember && !isOwnerRole(actorMember.role))
      throw ownerRequiredError();
    const target = locked.members.find((row) => row.userId === userId);
    if (!target) throw memberNotFoundError();
    const demoted = actorMember
      ? [actorMember.userId]
      : locked.members
          .filter((row) => isOwnerRole(row.role) && row.userId !== userId)
          .map((row) => row.userId);
    if (
      target.userId === actorMember?.userId ||
      (isOwnerRole(target.role) && demoted.length === 0)
    )
      throw new ApiError(400, {
        code: "ALREADY_OWNER",
        message: "This member is already the workspace owner",
      });

    if (demoted.length > 0)
      await tx
        .update(workspaceUserTable)
        .set({ role: "admin" })
        .where(
          and(
            eq(workspaceUserTable.workspaceId, workspaceId),
            inArray(workspaceUserTable.userId, demoted),
          ),
        );
    await tx
      .update(workspaceUserTable)
      .set({ role: "owner" })
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      );
    await clearMemberProjectAccess(workspaceId, userId, tx);
    if (actor.kind === "instance_admin")
      await recordWorkspaceMemberAction(tx, actor.audit, {
        action: "workspace.owner_transferred",
        workspaceId,
        userId,
        metadata: { previousRole: target.role, previousOwnerIds: demoted },
      });
  });

  await publishEvent("project_access.updated", { workspaceId, userId });
}
