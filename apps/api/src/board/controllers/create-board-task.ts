import createTask from "../../task/controllers/create-task";
import { ensureBoardProject } from "./ensure-board-project";

/**
 * A task is a top-level task in the workspace's hidden board project.
 * With an assignee and no subtasks it is a complete piece of work by itself.
 */
async function createBoardTask({
  workspaceId,
  currentUserId,
  title,
  description,
  userId,
}: {
  workspaceId: string;
  currentUserId: string;
  title: string;
  description?: string;
  userId?: string;
}) {
  const project = await ensureBoardProject(workspaceId);
  return createTask({
    projectId: project.id,
    currentUserId,
    userId,
    title,
    description,
    status: "to-do",
    priority: "no-priority",
  });
}

export default createBoardTask;
