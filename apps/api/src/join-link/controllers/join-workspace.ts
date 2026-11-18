import { and, count, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  workspaceJoinLinkTable,
  workspaceMemberRemovalTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { clearMemberProjectAccess } from "../../project-access/clear-member-project-access";
import { lockWorkspaceRow } from "../../workspace/lifecycle/lock-workspace-row";
import { handleMemberAdded } from "../../workspace-members/handle-member-added";
import {
  joinLinkNotFound,
  joinLinkUnavailable,
  memberLimitReached,
  removedFromWorkspace,
} from "../errors";
import { deriveLinkState } from "../lifecycle";
import { hashJoinToken, isJoinToken } from "../token";

// Parity with Better Auth's invitation accept.
export const WORKSPACE_MEMBER_LIMIT = 100;

type JoinResult = {
  outcome: "joined" | "already_member";
  workspace: { id: string; slug: string; name: string };
  linkId: string;
};

async function lockTeamWorkspace(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  workspaceId: string,
) {
  try {
    // Demo and missing workspaces are not found here.
    return await lockWorkspaceRow(tx, workspaceId);
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404)
      throw joinLinkNotFound();
    throw error;
  }
}

/**
 * Adds the caller to the link's workspace. Lock order is the repo's:
 * the workspace row first, then the link row. `workspace_member` has no
 * unique (workspace, user), so the workspace lock is what makes "add if
 * missing" safe against a second join, an admin add or a delete.
 */
async function joinWorkspace(token: string, userId: string) {
  if (!isJoinToken(token)) throw joinLinkNotFound();

  const result = await db.transaction(async (tx): Promise<JoinResult> => {
    // 1. Find the link without a lock.
    const [found] = await tx
      .select({
        id: workspaceJoinLinkTable.id,
        workspaceId: workspaceJoinLinkTable.workspaceId,
      })
      .from(workspaceJoinLinkTable)
      .where(eq(workspaceJoinLinkTable.tokenHash, hashJoinToken(token)))
      .limit(1);
    if (!found) throw joinLinkNotFound();

    // 2. Lock the workspace.
    const workspace = await lockTeamWorkspace(tx, found.workspaceId);
    if (workspace.archivedAt) throw joinLinkNotFound();

    // 3. Lock the link and check its state.
    const [link] = await tx
      .select()
      .from(workspaceJoinLinkTable)
      .where(eq(workspaceJoinLinkTable.id, found.id))
      .for("update");
    if (!link) throw joinLinkNotFound();
    const state = deriveLinkState(link, new Date());
    if (state.kind !== "active") throw joinLinkUnavailable(state);

    const summary = {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
    };

    // 5. Already a member: no use counted, no event.
    const [member] = await tx
      .select({ id: workspaceUserTable.id })
      .from(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspace.id),
          eq(workspaceUserTable.userId, userId),
        ),
      )
      .limit(1);
    if (member)
      return { outcome: "already_member", workspace: summary, linkId: link.id };

    // 6. A link made before the person's removal refuses them. Compared in
    // SQL: both times keep microseconds there.
    const [removal] = await tx
      .select({ userId: workspaceMemberRemovalTable.userId })
      .from(workspaceMemberRemovalTable)
      .where(
        and(
          eq(workspaceMemberRemovalTable.workspaceId, workspace.id),
          eq(workspaceMemberRemovalTable.userId, userId),
          sql`${workspaceMemberRemovalTable.removedAt} >= (
            select ${workspaceJoinLinkTable.createdAt}
            from ${workspaceJoinLinkTable}
            where ${workspaceJoinLinkTable.id} = ${link.id}
          )`,
        ),
      )
      .limit(1);
    if (removal) throw removedFromWorkspace();

    // 7. Member limit.
    const [members] = await tx
      .select({ total: count() })
      .from(workspaceUserTable)
      .where(eq(workspaceUserTable.workspaceId, workspace.id));
    if ((members?.total ?? 0) >= WORKSPACE_MEMBER_LIMIT)
      throw memberLimitReached(WORKSPACE_MEMBER_LIMIT);

    // 8. Access mode "all", the member row, and one use.
    await clearMemberProjectAccess(workspace.id, userId, tx);
    await tx.insert(workspaceUserTable).values({
      workspaceId: workspace.id,
      userId,
      role: link.role,
      joinedAt: new Date(),
    });
    await tx
      .update(workspaceJoinLinkTable)
      .set({ useCount: link.useCount + 1 })
      .where(eq(workspaceJoinLinkTable.id, link.id));

    return { outcome: "joined", workspace: summary, linkId: link.id };
  });

  // 9. After commit.
  if (result.outcome === "joined") {
    await handleMemberAdded(result.workspace.id, userId);
    await publishEvent("workspace.member_joined", {
      workspaceId: result.workspace.id,
      userId,
      linkId: result.linkId,
    });
  }
  return { outcome: result.outcome, workspace: result.workspace };
}

export default joinWorkspace;
