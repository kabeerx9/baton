/**
 * Where a new task may go. A board-project task stands alone; a repo task
 * sits under a feature. An unknown project kind is refused (the safe state).
 */
export type TaskPlacement = "ok" | "needs-parent";

export function taskPlacement({
  projectKind,
  hasParent,
}: {
  projectKind: string | null | undefined;
  hasParent: boolean;
}): TaskPlacement {
  if (projectKind === "board") return "ok";
  if (projectKind === "repo" && hasParent) return "ok";
  return "needs-parent";
}

export const NEEDS_PARENT_MESSAGE =
  "A task in a repo sits under a feature. Add it with POST /api/board/{taskId}/subtask, or create a standalone task with POST /api/board/workspace/{workspaceId}.";
