import type { PageState, TaskView } from "./derive";
import type { Status, TaskDetail } from "./types";

const names = (list: { key: string }[]) => list.map((t) => t.key).join(", ");

const firstName = (full: string) => full.split(" ")[0] ?? full;

export const STAGE_LABEL: Record<Status, string> = {
  todo: "To do",
  doing: "In progress",
  review: "In review",
  done: "Done",
};

/** The one sentence that answers "what is going on here". */
export function headline(state: PageState, task: TaskDetail): string {
  switch (state.kind) {
    case "unknown":
      return "Status unknown";
    case "done":
      return state.released.length > 0
        ? `Done. ${state.released.length === 1 ? "One task" : `${state.released.length} tasks`} can continue.`
        : "Done.";
    case "awaiting":
      return "A request is waiting for an answer.";
    case "blocked":
      return state.on.length === 1
        ? `Waiting on ${state.on[0]?.key}.`
        : `Waiting on ${state.on.length} tasks.`;
    case "active":
      if (state.stage === "todo")
        return task.assignee
          ? `${firstName(task.assignee.name)} has not started.`
          : "Ready to pick up.";
      if (state.stage === "doing")
        return `${task.assignee ? firstName(task.assignee.name) : "Someone"} is working on it.`;
      return "In review. Nothing in the way.";
  }
}

/** The line under the headline: who is affected, or what to do. */
export function subline(view: TaskView, task: TaskDetail): string {
  const { state } = view;
  if (state.kind === "done") {
    if (state.released.length > 0)
      return `${names(state.released)} ${state.released.length === 1 ? "was" : "were"} waiting on it.`;
    return `Finished ${task.activity[0]?.at ?? ""}.`.replace(" .", ".");
  }
  if (state.kind === "blocked")
    return `${names(state.on)} must finish first.${
      view.waitingOnMe.length > 0
        ? ` ${view.waitingOnMe.length} more ${view.waitingOnMe.length === 1 ? "task waits" : "tasks wait"} on this one.`
        : ""
    }`;
  if (view.waitingOnMe.length > 0)
    return `${names(view.waitingOnMe)} ${view.waitingOnMe.length === 1 ? "waits" : "wait"} on this task.`;
  if (state.kind === "awaiting") return state.request.expires + ".";
  return "Nothing waits on it.";
}

export function nextLabel(view: TaskView): string | null {
  const { next } = view;
  switch (next.kind) {
    case "none":
      return null;
    case "answer":
      return "Answer the request";
    case "wait":
      return `Wait for ${names(next.on)}`;
    case "assign":
      return "Take it";
    case "move": {
      const verb =
        next.to === "doing"
          ? "Start"
          : next.to === "review"
            ? "Send to review"
            : "Mark done";
      return next.direct ? verb : `Ask to ${verb.toLowerCase()}`;
    }
  }
}
