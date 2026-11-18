import { eq } from "drizzle-orm";
import db from "../../database";
import {
  userTable,
  workspaceJoinLinkTable,
  workspaceTable,
} from "../../database/schema";
import { toWorkspaceKind } from "../../workspace/kind/workspace-kind";
import { deriveLinkState } from "../lifecycle";
import type { JoinLinkPreview } from "../schema";
import { hashJoinToken, isJoinToken } from "../token";

const NOT_FOUND: JoinLinkPreview = {
  status: "unavailable",
  reason: "not_found",
};

/**
 * What an anonymous visitor may learn: the workspace name, the sharer's
 * name and the expiry, only while the link is active. Never ids, slug,
 * emails, counts. Archived, demo and unknown all read as not found.
 */
async function previewJoinLink(token: string): Promise<JoinLinkPreview> {
  if (!isJoinToken(token)) return NOT_FOUND;
  const [found] = await db
    .select({
      link: workspaceJoinLinkTable,
      workspaceName: workspaceTable.name,
      workspaceKind: workspaceTable.kind,
      archivedAt: workspaceTable.archivedAt,
      sharedByName: userTable.name,
    })
    .from(workspaceJoinLinkTable)
    .innerJoin(
      workspaceTable,
      eq(workspaceTable.id, workspaceJoinLinkTable.workspaceId),
    )
    .leftJoin(userTable, eq(userTable.id, workspaceJoinLinkTable.createdBy))
    .where(eq(workspaceJoinLinkTable.tokenHash, hashJoinToken(token)))
    .limit(1);
  if (
    !found ||
    found.archivedAt ||
    toWorkspaceKind(found.workspaceKind) !== "team"
  )
    return NOT_FOUND;

  const state = deriveLinkState(found.link, new Date());
  if (state.kind !== "active")
    return { status: "unavailable", reason: state.kind };
  return {
    status: "active",
    workspace: { name: found.workspaceName },
    sharedBy: found.sharedByName !== null ? { name: found.sharedByName } : null,
    expiresAt: found.link.expiresAt.toISOString(),
  };
}

export default previewJoinLink;
