import type { BoardResponse } from "@/fetchers/board/get-board";

export type Status = "todo" | "doing" | "review" | "done";

export type Person = {
  id: string;
  name: string;
  initials: string;
  hue: number;
  image: string | null;
};

export type Lane = {
  projectId: string;
  name: string;
  slug: string;
  repository: string | null;
  tone: Tone;
  /** The "no repo" lane for QA, design and ops subtasks. */
  general: boolean;
};

/** An open task that holds another one up. Same shape as the API's `LinkedTask`. */
export type Blocker = {
  id: string;
  key: string;
  title: string;
  assigneeName: string | null;
};

/** What every board item says about being held up. `isBlocked` reads only this. */
export type Blockable = {
  waitsOn: Blocker[];
  hiddenBlockers: number;
};

export type Subtask = Blockable & {
  id: string;
  key: string;
  title: string;
  projectId: string;
  status: Status;
  priority: string | null;
  /** ISO time or null. */
  dueDate: string | null;
  finishedAt: string | null;
  assignee: Person | null;
  pr: {
    number: number;
    state: "open" | "closed" | "merged";
    url: string;
  } | null;
  /** Map edges only: visible subtasks that block this one, any status. Never a blocked signal. */
  blockedBy: string[];
};

export type BoardTask = Blockable & {
  id: string;
  key: string;
  title: string;
  summary: string;
  /** The hidden board project. Needed to open the task page. */
  projectId: string;
  /** The task's own status and assignee. They matter when it has no subtasks. */
  status: Status;
  priority: string | null;
  dueDate: string | null;
  finishedAt: string | null;
  assignee: Person | null;
  /** Board column, decided by the API. */
  column: Status;
  subtasks: Subtask[];
};

export type Tone = { dot: string; text: string; bar: string; stroke: string };

// One hue per repo project, by order, so a task's home reads at a glance.
const TONES: Tone[] = [
  {
    dot: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
    bar: "bg-sky-500",
    stroke: "var(--color-sky-500)",
  },
  {
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    bar: "bg-orange-500",
    stroke: "var(--color-orange-500)",
  },
  {
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
    bar: "bg-violet-500",
    stroke: "var(--color-violet-500)",
  },
  {
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    stroke: "var(--color-emerald-500)",
  },
  {
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    stroke: "var(--color-rose-500)",
  },
  {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    stroke: "var(--color-amber-500)",
  },
];

const GENERAL_TONE: Tone = {
  dot: "bg-zinc-400",
  text: "text-muted-foreground",
  bar: "bg-zinc-400",
  stroke: "var(--color-zinc-400)",
};

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To do",
  doing: "In progress",
  review: "In review",
  done: "Done",
};

export function toStatus(task: {
  status: string;
  isCompleted: boolean;
}): Status {
  if (task.isCompleted) return "done";
  if (task.status === "in-progress") return "doing";
  if (task.status === "in-review") return "review";
  return "todo";
}

function hashHue(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function toPerson(
  a: { id: string; name: string; image: string | null } | null,
): Person | null {
  if (!a) return null;
  const parts = a.name.trim().split(/\s+/);
  const initials =
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  return {
    id: a.id,
    name: a.name.split(" ")[0] ?? a.name,
    initials,
    hue: hashHue(a.id),
    image: a.image,
  };
}

function summarize(description: string | null) {
  const text = (description ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

/** Turns the API board into what the three views draw. Lanes = repo projects. */
export function buildBoard(data: BoardResponse) {
  const boardTasks: BoardTask[] = data.tasks.map((f) => {
    const subtasks: Subtask[] = f.subtasks.map((s) => {
      const pr =
        s.pullRequests.find((p) => p.state === "open") ??
        s.pullRequests.at(-1) ??
        null;
      return {
        id: s.id,
        key: s.key,
        title: s.title,
        projectId: s.projectId,
        status: toStatus(s),
        assignee: toPerson(s.assignee),
        pr: pr ? { number: pr.number, state: pr.state, url: pr.url } : null,
        priority: s.priority,
        dueDate: s.dueDate,
        finishedAt: s.finishedAt,
        waitsOn: s.waitsOn,
        hiddenBlockers: s.hiddenBlockers,
        blockedBy: s.blockedBy,
      };
    });
    return {
      id: f.id,
      key: f.key,
      title: f.title,
      summary: summarize(f.description),
      projectId: f.projectId,
      status: toStatus(f),
      assignee: toPerson(f.assignee),
      column: f.column,
      priority: f.priority,
      dueDate: f.dueDate,
      finishedAt: f.finishedAt,
      waitsOn: f.waitsOn,
      hiddenBlockers: f.hiddenBlockers,
      subtasks,
    };
  });

  const lanes: Lane[] = data.projects
    .filter((p) => p.kind === "repo")
    .map((p, i) => ({
      projectId: p.id,
      name: p.name.replace(/\s*\(.*\)\s*$/, ""),
      slug: p.slug,
      repository: p.repository,
      tone: TONES[i % TONES.length]!,
      general: false,
    }));
  // Subtasks with no repo live in the board project itself.
  const board = data.projects.find((p) => p.kind === "board");
  if (board) {
    lanes.push({
      projectId: board.id,
      name: "No repo",
      slug: board.slug,
      repository: null,
      tone: GENERAL_TONE,
      general: true,
    });
  }

  return { boardTasks, lanes };
}

/**
 * The word for an item: a job with pieces is a feature, and everything else,
 * including each piece, is a task.
 */
export function kindOf(item: { subtasks: unknown[] }) {
  return item.subtasks.length > 0 ? "Feature" : "Task";
}

export function laneOf(lanes: Lane[], projectId: string) {
  return lanes.find((l) => l.projectId === projectId);
}

/** The one blocked rule: an open blocker, seen or hidden. The API already leaves done work out. */
export function isBlocked(item: Blockable) {
  return item.waitsOn.length + item.hiddenBlockers > 0;
}

export function progress(tasks: Subtask[]) {
  const done = tasks.filter((t) => t.status === "done").length;
  // Started work (in progress or in review) shows faintly, so it never reads as 0.
  const started = tasks.filter(
    (t) => t.status === "doing" || t.status === "review",
  ).length;
  const ratio = (n: number) => (tasks.length ? n / tasks.length : 0);
  return {
    done,
    started,
    total: tasks.length,
    ratio: ratio(done),
    startedRatio: ratio(done + started),
  };
}

/** The open tasks a feature or task waits on: its own and its subtasks', once each. */
export function waitingOn(boardTask: BoardTask): Blocker[] {
  const byId = new Map<string, Blocker>();
  for (const item of [boardTask, ...boardTask.subtasks]) {
    for (const blocker of item.waitsOn) byId.set(blocker.id, blocker);
  }
  return [...byId.values()];
}

/** Blockers you cannot see, from the feature and its subtasks. */
export function hiddenBlockerCount(boardTask: BoardTask) {
  return [boardTask, ...boardTask.subtasks].reduce(
    (sum, item) => sum + item.hiddenBlockers,
    0,
  );
}

/** A board task or a subtask by id, or undefined when it is not on the board. */
export function findBoardItem(
  boardTasks: BoardTask[],
  id: string,
): BoardTask | Subtask | undefined {
  return (
    boardTasks.find((t) => t.id === id) ??
    boardTasks.flatMap((t) => t.subtasks).find((s) => s.id === id)
  );
}

/**
 * The state a board item really has. A feature's own stored status is never
 * used (BOARD rule 3): its column follows its tasks. A task uses its status.
 */
export function effectiveStatus(item: BoardTask | Subtask): Status {
  return "column" in item ? item.column : item.status;
}
