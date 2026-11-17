import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { BoardResponse } from "@/fetchers/board/get-board";
import { TaskDetailPage } from "./task-detail-page";

const m = vi.hoisted(() => ({
  task: undefined as unknown,
  relations: [] as unknown[],
  board: undefined as unknown,
  item: undefined as unknown,
  itemEnabled: undefined as boolean | undefined,
  nothing: () => null,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: () => ({ data: m.task }),
}));
vi.mock("@/hooks/queries/task-relation/use-get-task-relations", () => ({
  default: () => ({ data: m.relations }),
}));
vi.mock("@/hooks/queries/board/use-get-board", () => ({
  useGetBoard: () => ({ data: m.board }),
}));
vi.mock("@/hooks/queries/board/use-get-board-item", () => ({
  useGetBoardItem: (_w: string, _t: string, enabled?: boolean) => {
    m.itemEnabled = enabled;
    return { data: m.item };
  },
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock("@/hooks/queries/activity/use-get-activities-by-task-id", () => ({
  default: () => ({ isLoading: false }),
}));
vi.mock("@/hooks/queries/external-link/use-external-links", () => ({
  default: () => ({ data: [], isLoading: false }),
}));

// The page's own wiring is under test. Its children are stand-ins that print
// what they were given.
vi.mock("@/components/external-links/external-links-accordion", () => ({
  ExternalLinksAccordion: m.nothing,
}));
vi.mock("@/components/board/add-subtask-dialog", () => ({
  AddSubtaskDialog: m.nothing,
}));
vi.mock("@/components/task/change-request/task-change-request", () => ({
  TaskChangeRequest: m.nothing,
}));
vi.mock("@/components/task/properties/property-chips", () => ({
  PropertyChips: m.nothing,
}));
vi.mock("@/components/task/task-activity", () => ({ TaskActivity: m.nothing }));
vi.mock("@/components/task/task-description", () => ({ default: m.nothing }));
vi.mock("@/components/task/task-relations", () => ({ default: m.nothing }));
vi.mock("@/components/task/task-title", () => ({ default: m.nothing }));
vi.mock("@/components/board/task-flow/waits-on-section", () => ({
  WaitsOnSection: m.nothing,
}));
vi.mock("./task-hero", () => ({
  TaskHero: (p: { bar: ReactNode; diagram: ReactNode }) => (
    <div>
      {p.bar}
      {p.diagram}
    </div>
  ),
}));
vi.mock("./task-headline", () => ({ TaskHeadline: m.nothing }));
vi.mock("./diagram/diagram-core", () => ({ DiagramCore: m.nothing }));
vi.mock("./diagram/task-diagram", () => ({
  TaskDiagram: (p: {
    waitsOn: { key: string; status: string }[];
    stillNeeded: boolean;
  }) => (
    <ul aria-label="waits on">
      {p.waitsOn.map((x) => (
        <li key={x.key}>{`${x.key}:${x.status}`}</li>
      ))}
      <li>{p.stillNeeded ? "still needed" : "free"}</li>
    </ul>
  ),
}));
vi.mock("./status-bar/task-status-bar", () => ({
  TaskStatusBar: ({ blocked }: { blocked: boolean }) => (
    <p>{blocked ? "bar: blocked" : "bar: open"}</p>
  ),
}));
vi.mock("@/components/board/task-flow/task-stream", () => ({
  TaskStream: ({ feature }: { feature: { subtasks: { title: string }[] } }) => (
    <ul aria-label="tasks">
      {feature.subtasks.map((s) => (
        <li key={s.title}>{s.title}</li>
      ))}
    </ul>
  ),
}));
vi.mock("@/components/board/task-flow/siblings", () => ({
  Siblings: ({ items }: { items: { title: string; status: string }[] }) => (
    <ul aria-label="siblings">
      {items.map((s) => (
        <li key={s.title}>{`${s.title}:${s.status}`}</li>
      ))}
    </ul>
  ),
}));

const base = {
  assignee: null,
  dueDate: null,
  priority: null,
  waitsOn: [],
  hiddenBlockers: 0,
  blockedBy: [],
  pendingRequest: null,
  pullRequests: [],
  description: null,
  statusGeneration: 3,
  statusChange: { move: "apply" },
  finishedAt: "2026-09-01T00:00:00.000Z",
};
const sub = (id: string, title: string) => ({
  ...base,
  id,
  key: id.toUpperCase(),
  title,
  projectId: "api",
  status: "done",
  isCompleted: true,
});
const oldFeature = {
  ...base,
  id: "f",
  key: "T-9",
  title: "Old feature",
  projectId: "board",
  status: "to-do",
  isCompleted: false,
  column: "done",
  subtasks: [sub("s1", "Build the API"), sub("s2", "Build the app")],
};
const emptyBoard = {
  tasks: [],
  olderDoneCount: 1,
  projects: [
    { id: "board", kind: "board", slug: "t", name: "Board", repository: null },
    { id: "api", kind: "repo", slug: "api", name: "API", repository: null },
  ],
  members: [],
} as never as BoardResponse;

const task = (id: string, over = {}) => ({
  id,
  title: id,
  number: 1,
  status: "done",
  projectId: "board",
  userId: null,
  assigneeName: null,
  statusGeneration: 3,
  statusChange: { move: "apply" },
  ...over,
});

const related = (id: string, over = {}) => ({
  id,
  title: id,
  status: "to-do",
  isCompleted: false,
  open: true,
  number: 7,
  projectId: "board",
  userId: null,
  assigneeName: null,
  ...over,
});

const page = (taskId: string, projectId = "board") =>
  render(
    <TaskDetailPage taskId={taskId} projectId={projectId} workspaceId="w" />,
  );

beforeEach(() => {
  m.board = emptyBoard;
  m.item = undefined;
  m.itemEnabled = undefined;
  m.relations = [];
});

describe("when the page reads the board item", () => {
  const subtaskOf = (parent: string, child: string) => ({
    relationType: "subtask",
    sourceTaskId: parent,
    targetTaskId: child,
    sourceTask: related(parent),
    targetTask: related(child),
  });
  const listed = {
    ...emptyBoard,
    tasks: [{ ...oldFeature, subtasks: [sub("s1", "Build the API")] }],
  } as never as BoardResponse;

  it("skips it when the board lists the task's feature", () => {
    m.board = listed;
    m.task = task("s1", { projectId: "api" });
    m.relations = [subtaskOf("f", "s1")];
    page("s1", "api");
    expect(m.itemEnabled).toBe(false);
  });

  it("skips it for a task with no feature", () => {
    m.task = task("plain", { projectId: "api" });
    page("plain", "api");
    expect(m.itemEnabled).toBe(false);
  });

  it("reads it when the feature is missing from the board", () => {
    m.task = task("s1", { projectId: "api" });
    m.relations = [subtaskOf("f", "s1")];
    page("s1", "api");
    expect(m.itemEnabled).toBe(true);
  });
});

describe("task page for work outside the Done window", () => {
  it("shows the tasks of an old done feature from the item read", () => {
    m.task = task("f");
    m.item = { task: oldFeature };
    page("f");
    const tasks = screen.getByRole("list", { name: "tasks" });
    expect(tasks).toHaveTextContent("Build the API");
    expect(tasks).toHaveTextContent("Build the app");
    // The page follows its tasks: it shows no status bar of its own.
    expect(screen.queryByText(/bar:/)).toBeNull();
  });

  it("shows the siblings of a task whose feature is old", () => {
    m.task = task("s1", { projectId: "api" });
    m.item = { task: oldFeature };
    m.relations = [
      {
        relationType: "subtask",
        sourceTaskId: "f",
        targetTaskId: "s1",
        sourceTask: related("f", { title: "Old feature", status: "to-do" }),
        targetTask: related("s1"),
      },
    ];
    page("s1", "api");
    expect(screen.getByRole("list", { name: "siblings" })).toHaveTextContent(
      "Build the app:done",
    );
  });

  it("does not show a linked old done feature as an open blocker", () => {
    m.task = task("me", { status: "to-do" });
    // The relation read says the feature is not open, although its own stored
    // status is still "to-do". The board does not list it: it is old.
    m.relations = [
      {
        relationType: "blocks",
        sourceTaskId: "g",
        targetTaskId: "me",
        sourceTask: related("g", { status: "to-do", open: false }),
        targetTask: related("me"),
      },
    ];
    page("me");
    expect(screen.getByRole("list", { name: "waits on" })).toHaveTextContent(
      "done",
    );
    expect(screen.getByText("bar: open")).toBeVisible();
    expect(screen.getByText("free")).toBeVisible();
  });

  it("still treats a linked open task as a blocker", () => {
    m.task = task("me", { status: "to-do" });
    m.relations = [
      {
        relationType: "blocks",
        sourceTaskId: "g",
        targetTaskId: "me",
        sourceTask: related("g", {
          status: "done",
          isCompleted: true,
          open: true,
        }),
        targetTask: related("me"),
      },
    ];
    page("me");
    expect(screen.getByText("bar: blocked")).toBeVisible();
  });
});
