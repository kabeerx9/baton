import { eq } from "drizzle-orm";
import db from "../database";
import {
  userTable,
  workspaceJoinLinkTable,
  workspaceTable,
} from "../database/schema";

/** The workspace name and the link sharer's name for a welcome message. */
export async function loadJoinFacts(workspaceId: string, linkId: string) {
  const [workspace] = await db
    .select({ name: workspaceTable.name })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);
  if (!workspace) return null;
  const [sharer] = await db
    .select({ name: userTable.name })
    .from(workspaceJoinLinkTable)
    .innerJoin(userTable, eq(userTable.id, workspaceJoinLinkTable.createdBy))
    .where(eq(workspaceJoinLinkTable.id, linkId))
    .limit(1);
  return { workspaceName: workspace.name, sharerName: sharer?.name ?? null };
}
