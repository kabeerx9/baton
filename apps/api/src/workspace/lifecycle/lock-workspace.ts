import { eq } from "drizzle-orm";
import { schema } from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { lockWorkspaceRow } from "./lock-workspace-row";

export type LockedMember = { id: string; userId: string; role: string };

/**
 * The lock every workspace mutation takes first: the workspace row, then its
 * member rows by id (BOARD.md lock order, workspace first). Admin routes pass
 * `allowDemo: false`, so a demo answers 404 there; member routes pass true
 * and apply the demo rule per family.
 */
export async function lockWorkspace(
  tx: DbOrTx,
  workspaceId: string,
  { allowDemo }: { allowDemo: boolean },
) {
  const workspace = await lockWorkspaceRow(tx, workspaceId, { allowDemo });
  const members: LockedMember[] = await tx
    .select({
      id: schema.workspaceUserTable.id,
      userId: schema.workspaceUserTable.userId,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(eq(schema.workspaceUserTable.workspaceId, workspaceId))
    .orderBy(schema.workspaceUserTable.id)
    .for("update");
  return { workspace, members };
}

export type LockedWorkspace = Awaited<ReturnType<typeof lockWorkspace>>;
