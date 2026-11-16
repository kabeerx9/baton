import { isStatus } from "./derive";
import { KABEER } from "./people";
import type {
  ActivityEntry,
  Person,
  Priority,
  Status,
  TaskDetail,
  Viewer,
} from "./types";

const LABEL: Record<Status, string> = {
  todo: "To do",
  doing: "In progress",
  review: "In review",
  done: "Done",
};

/** What the last action did. A new `id` each time, so a toast fires once. */
type OutcomeBody =
  | { kind: "none" }
  | { kind: "applied" | "requested" | "refused"; message: string };

export type Outcome = OutcomeBody & { id: number };

export type TaskState = { task: TaskDetail; outcome: Outcome };

export type TaskAction =
  | { type: "reset"; task: TaskDetail }
  | { type: "set-status"; to: Status; viewer: Viewer }
  | { type: "assign"; person: Person | null; viewer: Viewer }
  | { type: "set-priority"; priority: Priority }
  | { type: "comment"; body: string; author: Person }
  | { type: "answer"; accept: boolean; viewer: Viewer }
  | { type: "withdraw"; viewer: Viewer }
  | { type: "blocker-finished"; key: string };

export const initialState = (task: TaskDetail): TaskState => ({
  task,
  outcome: { kind: "none", id: 0 },
});

const entry = (
  task: TaskDetail,
  e: Omit<ActivityEntry, "id" | "at" | "hoursAgo">,
): ActivityEntry => ({
  ...e,
  id: `n${task.activity.length + 1}-${e.kind}`,
  at: "just now",
  hoursAgo: 0,
});

function next(state: TaskState, task: TaskDetail, outcome: OutcomeBody) {
  return {
    task,
    outcome: { ...outcome, id: state.outcome.id + 1 } as Outcome,
  };
}

const refuse = (state: TaskState, message: string): TaskState => ({
  ...state,
  outcome: { kind: "refused", id: state.outcome.id + 1, message },
});

const openBlockers = (task: TaskDetail) =>
  task.waitsOn.filter((t) => t.status !== "done");

/**
 * One pure transition for every mock interaction. It follows BOARD.md: a
 * blocked task can start but not finish; people who are not involved ask
 * through a change request instead of changing status; they cannot assign.
 */
export function taskReducer(state: TaskState, action: TaskAction): TaskState {
  const { task } = state;
  switch (action.type) {
    case "reset":
      return initialState(action.task);

    case "set-status": {
      if (!isStatus(task.status)) {
        return refuse(state, "This task has a status Baton does not know.");
      }
      if (action.to === task.status) return state;
      if (action.to === "done" && openBlockers(task).length > 0) {
        const keys = openBlockers(task)
          .map((t) => t.key)
          .join(", ");
        return refuse(state, `Can’t finish yet. Waiting on ${keys}.`);
      }
      if (!action.viewer.involved) {
        return next(
          state,
          {
            ...task,
            request: {
              id: `cr-${state.outcome.id + 1}`,
              requester: action.viewer.person,
              to: action.to,
              expires: "expires in 24h",
            },
          },
          {
            kind: "requested",
            message: `Asked to move it to ${LABEL[action.to]}.`,
          },
        );
      }
      return next(
        state,
        {
          ...task,
          status: action.to,
          request: null,
          activity: [
            entry(task, {
              kind: "status",
              actor: action.viewer.person,
              from: LABEL[task.status],
              to: LABEL[action.to],
            }),
            ...task.activity,
          ],
        },
        { kind: "applied", message: `Moved to ${LABEL[action.to]}.` },
      );
    }

    case "assign": {
      if (!action.viewer.involved) {
        return refuse(state, "Only people involved can assign this task.");
      }
      return next(
        state,
        {
          ...task,
          assignee: action.person,
          request: null,
          activity: [
            entry(task, {
              kind: "assign",
              actor: action.viewer.person,
              to: action.person?.name ?? "nobody",
            }),
            ...task.activity,
          ],
        },
        {
          kind: "applied",
          message: action.person
            ? `Assigned to ${action.person.name}.`
            : "Unassigned.",
        },
      );
    }

    case "set-priority": {
      if (action.priority === task.priority) return state;
      return next(
        state,
        {
          ...task,
          priority: action.priority,
          activity: [
            entry(task, {
              kind: "priority",
              actor: KABEER,
              from: task.priority,
              to: action.priority,
            }),
            ...task.activity,
          ],
        },
        { kind: "applied", message: `Priority set to ${action.priority}.` },
      );
    }

    case "comment": {
      const body = action.body.trim();
      if (!body) return state;
      return next(
        state,
        {
          ...task,
          activity: [
            entry(task, { kind: "comment", actor: action.author, body }),
            ...task.activity,
          ],
        },
        { kind: "none" },
      );
    }

    case "answer": {
      const request = task.request;
      if (!request || !action.viewer.involved) return state;
      if (request.requester.id === action.viewer.person.id) {
        return refuse(state, "Nobody answers their own request.");
      }
      if (!action.accept) {
        return next(
          state,
          { ...task, request: null },
          { kind: "applied", message: "Request rejected." },
        );
      }
      if (request.to === "done" && openBlockers(task).length > 0) {
        // BOARD.md: a blocked task still cannot be finished; the request ends cancelled.
        return next(
          state,
          { ...task, request: null },
          {
            kind: "refused",
            message: "Request cancelled. The task still waits on an open task.",
          },
        );
      }
      return next(
        state,
        {
          ...task,
          status: request.to,
          request: null,
          activity: [
            entry(task, {
              kind: "status",
              actor: action.viewer.person,
              from: isStatus(task.status) ? LABEL[task.status] : task.status,
              to: LABEL[request.to],
            }),
            ...task.activity,
          ],
        },
        {
          kind: "applied",
          message: `Accepted. Moved to ${LABEL[request.to]}.`,
        },
      );
    }

    case "withdraw": {
      if (!task.request) return state;
      if (task.request.requester.id !== action.viewer.person.id) {
        return refuse(state, "Only the requester withdraws a request.");
      }
      return next(
        state,
        { ...task, request: null },
        { kind: "applied", message: "Request withdrawn." },
      );
    }

    case "blocker-finished": {
      const blocker = task.waitsOn.find((t) => t.key === action.key);
      if (!blocker || blocker.status === "done") return state;
      const remaining = task.waitsOn.filter(
        (t) => t.status !== "done" && t.key !== action.key,
      ).length;
      return next(
        state,
        {
          ...task,
          waitsOn: task.waitsOn.map((t) =>
            t.key === action.key
              ? { ...t, status: "done", since: "finished just now" }
              : t,
          ),
          activity: [
            entry(task, {
              kind: "status",
              actor: blocker.owner ?? KABEER,
              body: blocker.key,
              from: LABEL[blocker.status],
              to: "Done",
            }),
            ...task.activity,
          ],
        },
        {
          kind: "applied",
          message:
            remaining === 0
              ? `${blocker.key} is done. You can continue.`
              : `${blocker.key} is done. ${remaining} more to wait on.`,
        },
      );
    }
  }
}
