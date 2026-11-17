import { asc, eq } from "drizzle-orm";
import { userTable, workspaceUserTable } from "../../database/schema";
import { pendingRequestsInWorkspace } from "../../task-change-request/pending-summaries";
import { boardSnapshot } from "./board-snapshot";
import { ensureBoardProject } from "./ensure-board-project";
import { getVisibleProjects } from "./get-visible-projects";
import { type BoardViewer, loadBoardItems } from "./load-board-items";
import { selectBoardWindow } from "./select-board-window";

/**
 * The workspace's board: every open item and the done items that finished at
 * or after `doneSince`, built by `loadBoardItems`, plus the visible projects
 * and the members. Selection, count and payload share one read-only snapshot,
 * so they agree. The board project is created first, outside the snapshot.
 */
async function getBoard(
  workspaceId: string,
  viewer: BoardViewer,
  doneSince: Date,
) {
  const { id: boardProjectId } = await ensureBoardProject(workspaceId);
  return boardSnapshot(async (tx) => {
    const window = await selectBoardWindow(tx, {
      workspaceId,
      boardProjectId,
      userId: viewer.userId,
      doneSince,
    });
    const projects = await getVisibleProjects(tx, workspaceId, viewer.userId);
    const tasks = await loadBoardItems(tx, {
      workspaceId,
      boardProjectId,
      viewer,
      projects,
      taskIds: window.ids,
      loadPending: () => pendingRequestsInWorkspace(workspaceId, tx),
    });
    const members = await tx
      .select({
        id: userTable.id,
        name: userTable.name,
        image: userTable.image,
      })
      .from(workspaceUserTable)
      .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
      .where(eq(workspaceUserTable.workspaceId, workspaceId))
      .orderBy(asc(userTable.name));

    return {
      tasks,
      projects,
      members,
      olderDoneCount: window.olderDoneCount,
      doneSince,
    };
  });
}

export default getBoard;
