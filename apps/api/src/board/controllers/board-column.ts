export type BoardColumn = "todo" | "doing" | "review" | "done";

type Work = { status: string; isCompleted: boolean };

function inReview(work: Work) {
  return !work.isCompleted && work.status === "in-review";
}

function started(work: Work) {
  return (
    work.isCompleted ||
    work.status === "in-progress" ||
    work.status === "in-review"
  );
}

/**
 * The one rule for where a task sits on the board.
 * With no subtasks it is a plain task and uses its own status. With subtasks
 * its own status is ignored: done when all are done, in review when every
 * unfinished one is in review, in progress once any has started.
 * An unknown status counts as not started.
 */
export function boardColumn(task: Work, subtasks: Work[]): BoardColumn {
  if (subtasks.length === 0) {
    if (task.isCompleted) return "done";
    if (inReview(task)) return "review";
    return task.status === "in-progress" ? "doing" : "todo";
  }
  const open = subtasks.filter((s) => !s.isCompleted);
  if (open.length === 0) return "done";
  if (open.every(inReview)) return "review";
  return subtasks.some(started) ? "doing" : "todo";
}
