import type { TaskDetail, Viewer } from "../../types";

/** BOARD.md rule 7 in plain words. `null` when the viewer changes status directly. */
export function consentLine(task: TaskDetail, viewer: Viewer): string | null {
  if (viewer.involved) return null;
  const who = [task.creator, task.assignee]
    .filter((p, i, a): p is NonNullable<typeof p> => !!p && a.indexOf(p) === i)
    .map((p) => p.name.split(" ")[0])
    .join(" and ");
  return `You are not involved. A change sends a request to ${who}.`;
}
