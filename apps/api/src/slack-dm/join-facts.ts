import { and, asc, eq } from "drizzle-orm";
import db from "../database";
import {
  userTable,
  workspaceJoinLinkTable,
  workspaceTable,
  workspaceUserTable,
} from "../database/schema";

export type Sharer = { id: string; name: string };

async function linkCreator(linkId: string): Promise<Sharer | null> {
  const [creator] = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(workspaceJoinLinkTable)
    .innerJoin(userTable, eq(userTable.id, workspaceJoinLinkTable.createdBy))
    .where(eq(workspaceJoinLinkTable.id, linkId))
    .limit(1);
  return creator ?? null;
}

async function workspaceOwner(workspaceId: string): Promise<Sharer | null> {
  const [owner] = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.role, "owner"),
      ),
    )
    .orderBy(asc(workspaceUserTable.joinedAt))
    .limit(1);
  return owner ?? null;
}

/**
 * The workspace name and who shared it, for a welcome message. The sharer is
 * the link's creator; when that account is gone, the workspace owner; else
 * nobody.
 */
export async function loadJoinFacts(workspaceId: string, linkId: string) {
  const [workspace] = await db
    .select({ name: workspaceTable.name })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);
  if (!workspace) return null;
  const sharer =
    (await linkCreator(linkId)) ?? (await workspaceOwner(workspaceId));
  return { workspaceName: workspace.name, sharer };
}
