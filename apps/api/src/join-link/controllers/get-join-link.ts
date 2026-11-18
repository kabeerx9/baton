import { and, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceJoinLinkTable } from "../../database/schema";
import { toJoinLink } from "../response";

/** The workspace's one link that is not revoked, in any state, or null. */
async function getJoinLink(workspaceId: string) {
  const [found] = await db
    .select({
      link: workspaceJoinLinkTable,
      creatorId: userTable.id,
      creatorName: userTable.name,
    })
    .from(workspaceJoinLinkTable)
    .leftJoin(userTable, eq(userTable.id, workspaceJoinLinkTable.createdBy))
    .where(
      and(
        eq(workspaceJoinLinkTable.workspaceId, workspaceId),
        isNull(workspaceJoinLinkTable.revokedAt),
      ),
    )
    .limit(1);
  if (!found) return { link: null };
  const creator =
    found.creatorId && found.creatorName !== null
      ? { id: found.creatorId, name: found.creatorName }
      : null;
  return { link: toJoinLink(found.link, creator, new Date()) };
}

export default getJoinLink;
