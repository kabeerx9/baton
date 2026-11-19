import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { BoardResponse } from "@/fetchers/board/get-board";
import { TaskDetailPage } from "./task-detail-page";

const permissions = vi.hoisted(() => ({
  canCreateTasks: true,
  canCreateProjects: true,
  canUpdateTasks: true,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => permissions.canCreateTasks,
    canCreateProjects: () => permissions.canCreateProjects,
    canUpdateTasks: () => permissions.canUpdateTasks,
  }),
}));

const m = vi.hoisted(() => ({
  task: undefined as unknown,
  relations: [] as unknown[],
  board: undefined as unknown,
  boardLoading: false,
  item: undefined as unknown,
  itemLoading: false,
  itemEnabled: undefined as boolean | undefined,
  laneProjectIds: [] as string[],
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
  useGetBoard: () => ({
    data: m.board,
    isLoading: m.boardLoading,
    isError: false,
  }),
}));
vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: ({ id }: { id: string }) => ({
    data: { id, slug: id, name: id },
    isLoading: false,
  }),
}));
vi.mock("@/hooks/queries/board/use-get-board-item", () => ({
  useGetBoardItem: (_w: string, _t: string, enabled?: boolean) => {
    m.itemEnabled = enabled;
    return { data: m.item, isLoading: m.itemLoading };
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
  AddSubtaskDialog: () => <p>add task dialog</p>,
}));
vi.mock("@/components/board/lane-sockets", () => ({
  LaneSockets: ({ projectIds }: { projectIds: string[] }) => {
    m.laneProjectIds = projectIds;
    return null;
  },
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
  TaskHero: (p: { bar: ReactNode; diagram: ReactNode; keyLabel: string }) => (
    <div>
      <p>{p.keyLabel}</p>
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
  TaskStream: ({
    feature,
    onAdd,
  }: {
    feature: { subtasks: { title: string }[] };
    onAdd?: () => void;
  }) => (
    <>
      <ul aria-label="tasks">
        {feature.subtasks.map((s) => (
          <li key={s.title}>{s.title}</li>
        ))}
      </ul>
      {onAdd && (
        <button type="button" onClick={onAdd}>
          Add task
        </button>
      )}
    </>
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

const page = (taskId: string, projectId = "board", openAddTask = false) =>
  render(
    <TaskDetailPage
      taskId={taskId}
      projectId={projectId}
      workspaceId="w"
      openAddTask={openAddTask}
    />,
  );

beforeEach(() => {
  m.board = emptyBoard;
  m.boardLoading = false;
  m.item = undefined;
  m.itemLoading = false;
  m.itemEnabled = undefined;
  m.laneProjectIds = [];
  m.relations = [];
  permissions.canCreateTasks = true;
});

describe("adding a task under this one", () => {
  it("offers Add task to people who can create tasks", () => {
    m.task = task("f");
    m.item = { task: oldFeature };
    page("f");
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.getByText("add task dialog")).toBeTruthy();
  });

  it("gives a viewer no Add task button, even from the URL request", () => {
    permissions.canCreateTasks = false;
    m.task = task("f");
    m.item = { task: oldFeature };
    page("f", "board", true);
    expect(screen.queryByRole("button", { name: "Add task" })).toBeNull();
    expect(screen.queryByText("add task dialog")).toBeNull();
  });
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

describe("feature status area", () => {
  const open = (id: string, over = {}) => ({
    ...sub(id, `Task ${id}`),
    status: "to-do",
    isCompleted: false,
    finishedAt: null,
    ...over,
  });
  const live = (subtasks: unknown[]) =>
    ({
      ...emptyBoard,
      tasks: [{ ...oldFeature, column: "todo", finishedAt: null, subtasks }],
    }) as never as BoardResponse;
  const pulse = () =>
    screen.queryByRole("list", { name: "tasks:hero.feature.pulse.barLabel" });
  const lanes = () =>
    screen.queryByRole("region", { name: "tasks:hero.feature.lanes.title" });

  it("shows Pulse alone for a feature with no links", () => {
    m.board = live([open("s1"), open("s2", { status: "in-progress" })]);
    m.task = task("f", { status: "to-do" });
    page("f");
    expect(pulse()).not.toBeNull();
    expect(lanes()).toBeNull();
    expect(screen.queryByText(/bar:/)).toBeNull();
  });

  it("adds Lanes when a task waits on another", () => {
    m.board = live([
      open("s1", { status: "in-progress" }),
      open("s2", {
        waitsOn: [
          { id: "s1", key: "S1", title: "Task s1", assigneeName: null },
        ],
      }),
    ]);
    m.task = task("f", { status: "to-do" });
    page("f");
    expect(pulse()).not.toBeNull();
    expect(lanes()).not.toBeNull();
  });

  it("adds Lanes when the feature itself waits on another feature", () => {
    m.board = live([open("s1")]);
    m.task = task("f", { status: "to-do" });
    m.relations = [
      {
        relationType: "blocks",
        sourceTaskId: "g",
        targetTaskId: "f",
        sourceTask: related("g", { status: "to-do", open: true }),
        targetTask: related("f"),
      },
    ];
    page("f");
    expect(lanes()).not.toBeNull();
  });

  it("keeps a plain task's hero: the status bar and no feature area", () => {
    m.board = {
      ...emptyBoard,
      tasks: [{ ...oldFeature, id: "p", subtasks: [] }],
    } as never as BoardResponse;
    m.task = task("p", { status: "to-do" });
    page("p");
    expect(screen.getByText("bar: open")).toBeVisible();
    expect(pulse()).toBeNull();
    expect(lanes()).toBeNull();
  });

  it("moves the bar when the board changes, with no reload", () => {
    m.board = live([open("s1"), open("s2")]);
    m.task = task("f", { status: "to-do" });
    const view = page("f");
    const segments = () =>
      [
        ...screen
          .getByRole("list", { name: "tasks:hero.feature.pulse.barLabel" })
          .querySelectorAll("li > span.fs-grow"),
      ].map((el) => el.className.endsWith("bg-emerald-500"));
    expect(segments()).toEqual([false, false]);
    m.board = live([
      open("s1", { status: "done", isCompleted: true }),
      open("s2"),
    ]);
    view.rerender(
      <TaskDetailPage taskId="f" projectId="board" workspaceId="w" />,
    );
    expect(segments()).toEqual([true, false]);
  });
});

describe("first paint", () => {
  it("shows the skeleton until the workspace board resolves", () => {
    m.board = undefined;
    m.boardLoading = true;
    m.task = task("plain", { projectId: "api" });
    const { container } = page("plain", "api");

    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(screen.queryByText("bar: open")).toBeNull();
  });

  it("shows the skeleton until the board item resolves", () => {
    m.task = task("f");
    m.relations = [
      {
        relationType: "subtask",
        sourceTaskId: "f",
        targetTaskId: "child",
        sourceTask: related("f"),
        targetTask: related("child"),
      },
    ];
    m.item = undefined;
    m.itemLoading = true;
    const { container } = page("f");

    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("draws a task key from the project's slug, never a question mark", () => {
    m.task = task("plain", { projectId: "api", number: 24 });
    page("plain", "api");

    expect(screen.getByText("api-24")).toBeVisible();
    expect(screen.queryByText(/\?-24/)).toBeNull();
  });
});

describe("live cross-project links", () => {
  it("keeps a socket on every other project the board draws from", () => {
    m.task = task("plain", { projectId: "board" });
    page("plain");

    expect(m.laneProjectIds).toEqual(["api"]);
  });
});
