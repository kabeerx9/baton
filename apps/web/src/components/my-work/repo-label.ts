/**
 * The repo name to show for a task. A task with no repo lives in the hidden
 * board project, whose name the UI never shows. Until the board project is
 * known there is no safe name, so the label is empty.
 */
export function repoLabel(
  project: { id: string; name: string },
  boardProjectId: string | undefined,
  noRepo: string,
) {
  if (boardProjectId === undefined) return "";
  return project.id === boardProjectId ? noRepo : project.name;
}
