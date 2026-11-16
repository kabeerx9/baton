import { APIError } from "better-auth/api";
import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { revokeWorkspaceConnections } from "../../ws";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { instanceAdminRoleSql } from "../../utils/instance-admin-role";
import {
  formatBlockedWorkspacesMessage,
  hasOwnerRole,
  planAccountDeletion,
  type WorkspaceMembershipSummary,
} from "../account-deletion";
import { deleteResourceNotifications } from "../../notification/delete-resource-notifications";

async function collectMemberships(
  userId: string,
  database: DbOrTx,
): Promise<WorkspaceMembershipSummary[]> {
  const memberships = await database
    .select({
      workspaceId: workspaceUserTable.workspaceId,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.userId, userId));

  if (memberships.length === 0) {
    return [];
  }

  const workspaceIds = memberships.map((membership) => membership.workspaceId);

  const members = await database
    .select({
      workspaceId: workspaceUserTable.workspaceId,
      workspaceName: workspaceTable.name,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .innerJoin(
      workspaceTable,
      eq(workspaceUserTable.workspaceId, workspaceTable.id),
    )
    .where(inArray(workspaceUserTable.workspaceId, workspaceIds));

  return memberships.map((membership) => {
    const workspaceMembers = members.filter(
      (member) => member.workspaceId === membership.workspaceId,
    );

    return {
      workspaceId: membership.workspaceId,
      workspaceName: workspaceMembers[0]?.workspaceName ?? "workspace",
      isOwner: hasOwnerRole(membership.role),
      memberCount: workspaceMembers.length,
      ownerCount: workspaceMembers.filter((member) => hasOwnerRole(member.role))
        .length,
    };
  });
}

/**
 * Locks the workspaces an account deletion removes, one row at a time in id
 * order. A multi-row DELETE locks rows in the order its plan visits them,
 * while change request decisions lock up to two workspaces by id (see
 * `lockWorkspacesShared`); without this the two can deadlock.
 */
async function lockWorkspacesForDeletion(
  database: DbOrTx,
  workspaceIds: string[],
) {
  for (const id of [...workspaceIds].sort()) {
    await database
      .select({ id: workspaceTable.id })
      .from(workspaceTable)
      .where(eq(workspaceTable.id, id))
      .for("update");
  }
}

async function deleteAccountRows(userId: string, database: DbOrTx) {
  // Lock order everywhere: the user row first, then workspaces (the tour
  // routes and the demo cleanup do the same). NO KEY UPDATE still lets other
  // transactions insert rows that reference this user, such as the audit
  // entry of an administrator deleting a workspace this deletion waits on.
  await database
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .for("no key update");
  const plan = planAccountDeletion(await collectMemberships(userId, database));

  if (plan.blockedWorkspaceNames.length > 0) {
    throw new APIError("CONFLICT", {
      code: "SOLE_WORKSPACE_OWNER",
      message: formatBlockedWorkspacesMessage(plan.blockedWorkspaceNames),
    });
  }

  const recipients = new Set([userId]);
  if (plan.workspaceIdsToDelete.length > 0) {
    const admins = await database
      .select({ userId: userTable.id })
      .from(userTable)
      .where(instanceAdminRoleSql(userTable.role));
    for (const admin of admins) recipients.add(admin.userId);
    await lockWorkspacesForDeletion(database, plan.workspaceIdsToDelete);
    await deleteResourceNotifications(database, {
      workspaceIds: plan.workspaceIdsToDelete,
    });
    await database
      .delete(workspaceTable)
      .where(inArray(workspaceTable.id, plan.workspaceIdsToDelete));
  }

  if (plan.workspaceIdsToLeave.length > 0) {
    await database
      .delete(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.userId, userId),
          inArray(workspaceUserTable.workspaceId, plan.workspaceIdsToLeave),
        ),
      );
  }

  return { plan, recipients };
}

/**
 * Deletes the workspaces an account solely belongs to and leaves the rest.
 * Runs in the supplied transaction, or in its own; with its own, sockets
 * are revoked after the commit.
 */
export async function deleteAccountData(userId: string, database?: DbOrTx) {
  const { plan, recipients } = database
    ? await deleteAccountRows(userId, database)
    : await db.transaction((tx) => deleteAccountRows(userId, tx));

  for (const workspaceId of plan.workspaceIdsToDelete) {
    await Promise.all(
      [...recipients].map((recipient) =>
        revokeWorkspaceConnections(recipient, workspaceId, { force: true }),
      ),
    );
  }

  for (const workspaceId of plan.workspaceIdsToLeave) {
    await revokeWorkspaceConnections(userId, workspaceId, { force: true });
  }

  return plan;
}

export default deleteAccountData;
