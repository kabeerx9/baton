import { and, eq } from "drizzle-orm";
import db from "../database";
import { workspaceUserTable } from "../database/schema";
import { ApiError } from "../errors/api-error";
import { recordWorkspaceMemberAction } from "../admin/audit/record-workspace-member-action";
import { isAssignableWorkspaceRole } from "../admin/is-assignable-workspace-role";
import { isOwnerRole } from "../project-access/is-owner-role";
import { publishMembersUpdated } from "./publish-members-updated";
import { lockWorkspace } from "../workspace/lifecycle/lock-workspace";
import { authorizeWorkspaceWrite } from "../workspace/write/authorize-workspace-write";
import type { WorkspaceActor } from "../workspace/write/workspace-actor";
import {
  memberNotFoundError,
  onlyOwnerError,
  ownerRequiredError,
} from "../workspace/write/write-errors";

/** Change a member's role. `owner` moves only by transfer. */
export async function changeWorkspaceMemberRole(input: {
  workspaceId: string;
  userId: string;
  role: string;
  actor: WorkspaceActor;
}) {
  const { workspaceId, userId, role, actor } = input;
  await db.transaction(async (tx) => {
    const locked = await lockWorkspace(tx, workspaceId, {
      allowDemo: actor.kind === "member",
    });
    const actorMember = await authorizeWorkspaceWrite(tx, locked, actor, {
      permissions: { member: ["update"] },
      refuseDemo: true,
    });
    const target = locked.members.find((row) => row.userId === userId);
    if (!target) throw memberNotFoundError();
    if (!(await isAssignableWorkspaceRole(tx, workspaceId, role)))
      throw new ApiError(400, {
        code: "UNKNOWN_ROLE",
        message:
          "Unknown role. Use the ownership transfer to make someone the owner",
      });
    if (isOwnerRole(target.role)) {
      if (actorMember && !isOwnerRole(actorMember.role))
        throw ownerRequiredError();
      if (locked.members.filter((row) => isOwnerRole(row.role)).length === 1)
        throw onlyOwnerError(
          "Transfer ownership to another member before changing the only owner's role",
        );
    }

    await tx
      .update(workspaceUserTable)
      .set({ role })
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      );
    if (actor.kind === "instance_admin" && target.role !== role)
      await recordWorkspaceMemberAction(tx, actor.audit, {
        action: "workspace.member_role_changed",
        workspaceId,
        userId,
        metadata: { previousRole: target.role, role },
      });
  });

  await publishMembersUpdated(workspaceId);
  return { workspaceId, userId, role };
}
