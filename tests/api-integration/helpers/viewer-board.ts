import db, { schema } from "../../../apps/api/src/database";
import { ensureBoardProject } from "../../../apps/api/src/board/controllers/ensure-board-project";
import { createWorkspaceMember } from "./fixtures";
import { addWorkspaceMember } from "./project-access/add-workspace-member";

/**
 * A board with `own` (assigned to the viewer) and `other` (assigned to a
 * member). The creator of both is `creator`; `member` is an outsider.
 */
export async function seedViewerBoard(role = "viewer") {
  const { user: creator, workspace } = await createWorkspaceMember();
  const viewer = await addWorkspaceMember(workspace.id, role);
  const member = await addWorkspaceMember(workspace.id);
  const board = await ensureBoardProject(workspace.id);
  const insert = async (number: number, userId: string) => {
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: board.id,
        number,
        position: number,
        title: `Task ${number}`,
        status: "to-do",
        createdBy: creator.id,
        userId,
      })
      .returning();
    return task;
  };
  const own = await insert(1, viewer.id);
  const other = await insert(2, member.id);
  const [label] = await db
    .insert(schema.labelTable)
    .values({ name: "bug", color: "red", workspaceId: workspace.id })
    .returning();
  return { workspace, board, creator, viewer, member, own, other, label };
}
