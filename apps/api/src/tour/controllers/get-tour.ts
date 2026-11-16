import { and, eq } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceTable } from "../../database/schema";

async function getTour(userId: string) {
  const [row] = await db
    .select({
      tourCompletedAt: userTable.tourCompletedAt,
      demoId: workspaceTable.id,
      demoSlug: workspaceTable.slug,
    })
    .from(userTable)
    .leftJoin(
      workspaceTable,
      and(
        eq(workspaceTable.demoOwnerUserId, userTable.id),
        eq(workspaceTable.kind, "demo"),
      ),
    )
    .where(eq(userTable.id, userId))
    .limit(1);
  return {
    completed: Boolean(row?.tourCompletedAt),
    demoWorkspace:
      row?.demoId && row.demoSlug
        ? { id: row.demoId, slug: row.demoSlug }
        : null,
  };
}

export default getTour;
