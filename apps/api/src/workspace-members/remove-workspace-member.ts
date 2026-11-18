import { and, eq } from "drizzle-orm";
import db from "../database";
import { userTable, workspaceUserTable } from "../database/schema";
import { recordWorkspaceMemberAction } from "../admin/audit/record-workspace-member-action";
import { recordMemberRemoval } from "../join-link/record-member-removal";
import { clearMemberProjectAccess } from "../project-access/clear-member-project-access";
import { isOwnerRole } from "../project-access/is-owner-role";
import { lockWorkspace } from "../workspace/lifecycle/lock-workspace";
import { authorizeWorkspaceWrite } from "../workspace/write/authorize-workspace-write";
import type { WorkspaceActor } from "../workspace/write/workspace-actor";
import {
  memberNotFoundError,
  onlyOwnerError,
  ownerRequiredError,
} from "../workspace/write/write-errors";
import { assertStoredOwnerRoleSafe } from "./assert-stored-owner-role-safe";
import { handleMemberRemoved } from "./handle-member-removed";

/** Remove a member. The member route and `/api/admin/*` share this path. */
export async function removeWorkspaceMember(input: {
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
      permissions: { member: ["delete"] },
      refuseDemo: true,
    });
    // A legacy padded owner token never acts as ownership (auth.ts:669-682).
    if (actorMember) assertStoredOwnerRoleSafe(actorMember.role);
    const target = locked.members.find((row) => row.userId === userId);
    if (!target) throw memberNotFoundError();
    if (isOwnerRole(target.role)) {
      if (actorMember && !isOwnerRole(actorMember.role))
        throw ownerRequiredError();
      if (locked.members.filter((row) => isOwnerRole(row.role)).length === 1)
        throw onlyOwnerError(
          "Transfer ownership to another member before removing the only owner",
        );
    }
    // Before the delete, in its transaction: an old join link never
    // readmits the person, and a failed record rolls the removal back.
    await recordMemberRemoval(tx, workspaceId, userId);
    await tx
      .delete(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      );
    await clearMemberProjectAccess(workspaceId, userId, tx);
    if (actor.kind === "instance_admin")
      await recordWorkspaceMemberAction(tx, actor.audit, {
        action: "workspace.member_removed",
        workspaceId,
        userId,
        metadata: { role: target.role },
      });
  });

  const [user] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  await handleMemberRemoved({ workspaceId, userId, userRole: user?.role });
}
