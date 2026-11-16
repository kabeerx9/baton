import type {
  ChangeRequest,
  Linked,
  Status,
  TaskDetail,
  Viewer,
} from "./types";

const STATUSES: readonly Status[] = ["todo", "doing", "review", "done"];

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}

/** The one headline for the page. Variants present it; none of them re-derive it. */
export type PageState =
  | { kind: "unknown" }
  | { kind: "done"; released: Linked[]; stillWaiting: Linked[] }
  | { kind: "awaiting"; request: ChangeRequest; canAnswer: boolean }
  | { kind: "blocked"; on: Linked[]; stage: Status }
  | { kind: "active"; stage: "todo" | "doing" | "review" };

export type NextAction =
  | { kind: "none" }
  | { kind: "answer"; request: ChangeRequest }
  | { kind: "wait"; on: Linked[] }
  | { kind: "move"; to: Status; direct: boolean }
  | { kind: "assign" };

export type TaskView = {
  state: PageState;
  next: NextAction;
  /** Open tasks that wait on this one. */
  waitingOnMe: Linked[];
  /** Open tasks this one waits on. */
  openBlockers: Linked[];
  /** Real status, `null` when the stored value is not one we know. */
  status: Status | null;
};

const open = (t: Linked) => t.status !== "done";

const FOLLOWING: Record<"todo" | "doing" | "review", Status> = {
  todo: "doing",
  doing: "review",
  review: "done",
};

/**
 * BOARD.md rules 5 and 7: a blocked task can start but not finish, and only
 * involved people move it directly. An unknown stored status is the safe
 * state: no active look, no actions.
 */
export function deriveTaskView(task: TaskDetail, viewer: Viewer): TaskView {
  const waitingOnMe = task.blocks.filter(open);
  const openBlockers = task.waitsOn.filter(open);

  if (!isStatus(task.status)) {
    return {
      state: { kind: "unknown" },
      next: { kind: "none" },
      waitingOnMe: [],
      openBlockers,
      status: null,
    };
  }
  const status = task.status;

  if (status === "done") {
    return {
      state: {
        kind: "done",
        released: task.blocks.filter(
          (t) => open(t) && (t.otherBlockers ?? 0) === 0,
        ),
        stillWaiting: task.blocks.filter(
          (t) => open(t) && (t.otherBlockers ?? 0) > 0,
        ),
      },
      next: { kind: "none" },
      waitingOnMe: [],
      openBlockers,
      status,
    };
  }

  if (task.request) {
    return {
      state: {
        kind: "awaiting",
        request: task.request,
        canAnswer:
          viewer.involved && task.request.requester.id !== viewer.person.id,
      },
      next:
        viewer.involved && task.request.requester.id !== viewer.person.id
          ? { kind: "answer", request: task.request }
          : { kind: "none" },
      waitingOnMe,
      openBlockers,
      status,
    };
  }

  const following = FOLLOWING[status];
  const wouldFinish = following === "done";
  if (openBlockers.length > 0) {
    return {
      state: { kind: "blocked", on: openBlockers, stage: status },
      // Blocked is a signal: starting is allowed, finishing is not.
      next: wouldFinish
        ? { kind: "wait", on: openBlockers }
        : { kind: "move", to: following, direct: viewer.involved },
      waitingOnMe,
      openBlockers,
      status,
    };
  }

  return {
    state: { kind: "active", stage: status },
    next:
      status === "todo" && !task.assignee && viewer.involved
        ? { kind: "assign" }
        : { kind: "move", to: following, direct: viewer.involved },
    waitingOnMe,
    openBlockers,
    status,
  };
}
