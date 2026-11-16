import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import type { BoardResponse } from "@/fetchers/board/get-board";
import { demoBoard, TASK_IDS } from "./test-fixtures";
import { TourRunner, type TourEnv } from "./tour-runner";

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const getBoard = vi.hoisted(() => vi.fn());
vi.mock("@/fetchers/board/get-board", () => ({ default: getBoard }));

const START = {
  demoWorkspace: { id: "demo", slug: "demo-x", projectId: "p1" },
  tasks: Object.entries(TASK_IDS).map(([key, id]) => ({ key, id })),
};
const BOARD_KEY = ["task-board", "demo"];

function setup(overrides: Partial<TourEnv> = {}) {
  const env = {
    start: vi.fn().mockResolvedValue(START),
    finish: vi.fn().mockResolvedValue({ completed: true }),
    goTo: vi.fn(),
    leaveDemo: vi.fn(),
    originWorkspaceId: "real",
    onError: vi.fn(),
    onClosed: vi.fn(),
    ...overrides,
  } satisfies TourEnv;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const board = (data: BoardResponse) => {
    getBoard.mockResolvedValue(data);
    queryClient.setQueryData(BOARD_KEY, data);
  };
  board(demoBoard());
  render(
    <QueryClientProvider client={queryClient}>
      <TourRunner env={env} />
    </QueryClientProvider>,
  );
  return { env, queryClient, board };
}

/** Elements the tour points at. The real pages provide these. */
function mountTargets() {
  const ids = ["board", "board-columns", "my-tasks"];
  const els = ids.map((tour) => {
    const el = document.createElement("div");
    el.dataset.tour = tour;
    document.body.append(el);
    return el;
  });
  for (const id of [TASK_IDS["api-endpoint"], TASK_IDS["write-tests"]]) {
    const el = document.createElement("div");
    el.dataset.tour = "task-card";
    el.dataset.tourTask = id;
    document.body.append(el);
    els.push(el);
  }
  return els;
}

let targets: HTMLElement[] = [];
beforeEach(() => {
  targets = mountTargets();
  // Reduced motion keeps the finish animation to a short crossfade.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  getBoard.mockReset();
});
afterEach(() => {
  for (const el of targets) el.remove();
  vi.unstubAllGlobals();
});

const heading = (step: string) =>
  screen.findByRole("heading", { name: `steps.${step}.title` });

const next = () =>
  fireEvent.click(screen.getByRole("button", { name: "next" }));

describe("TourRunner", () => {
  it("walks every step, advancing the interactive one on data, not on a click", async () => {
    const { env, queryClient, board } = setup();

    expect(await heading("board")).toBeInTheDocument();
    expect(env.goTo).toHaveBeenLastCalledWith("demo", "board");
    next();
    expect(await heading("demo-tasks")).toBeInTheDocument();
    next();
    expect(await heading("my-tasks")).toBeInTheDocument();
    expect(env.goTo).toHaveBeenLastCalledWith("demo", "my-tasks");
    next();

    // Interactive step: no Next button, and clicking the target does nothing.
    expect(await heading("move-task")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "next" })).toBeNull();
    fireEvent.click(targets.at(-2) as HTMLElement);
    expect(
      screen.getByRole("heading", { name: "steps.move-task.title" }),
    ).toBeInTheDocument();
    expect(env.goTo).toHaveBeenLastCalledWith("demo", "board");

    // The query cache says the task is done: the tour moves on its own.
    act(() => board(demoBoard({ apiDone: true })));
    expect(await heading("unblocked")).toBeInTheDocument();
    expect(queryClient.getQueryData(BOARD_KEY)).toBeDefined();
    next();

    expect(await heading("mcp")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "steps.mcp.link" }),
    ).toHaveAttribute("href", "/dashboard/settings/account/agents");
    fireEvent.click(screen.getByRole("button", { name: "finish" }));

    await waitFor(() => expect(env.finish).toHaveBeenCalledWith("finished"));
    // finishing -> animating: the finish animation covers the screen ...
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="finish-break"]'),
      ).not.toBeNull(),
    );
    // ... the real workspace loads underneath once it is covered ...
    await waitFor(() => expect(env.leaveDemo).toHaveBeenCalledTimes(1));
    // ... and the tour closes when the animation ends.
    await waitFor(() => expect(env.onClosed).toHaveBeenCalledWith("finished"), {
      timeout: 3000,
    });
    expect(vi.mocked(env.leaveDemo).mock.calls[0]?.[0]).toMatchObject({
      demoWorkspaceId: "demo",
      originWorkspaceId: "real",
    });
  });

  it("skips on any step after a confirmation, without the animation", async () => {
    const { env } = setup();
    await heading("board");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByText("skipConfirm.title")).toBeInTheDocument();
    // Escape again goes back to the step.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(await heading("board")).toBeInTheDocument();
    expect(env.finish).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "skip" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "skipConfirm.confirm" }),
    );

    await waitFor(() => expect(env.finish).toHaveBeenCalledWith("skipped"));
    await waitFor(() => expect(env.onClosed).toHaveBeenCalledWith("skipped"));
    expect(env.leaveDemo).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-slot="finish-break"]')).toBeNull();
  });

  it("closes quietly, with no finish call, when a demo task disappears", async () => {
    const { env, board } = setup();
    await heading("board");
    act(() => board(demoBoard({ without: "write-tests" })));
    await waitFor(() =>
      expect(env.onClosed).toHaveBeenCalledWith("demo-missing"),
    );
    expect(env.finish).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes quietly when the demo workspace is gone", async () => {
    const { env, queryClient } = setup();
    await heading("board");
    getBoard.mockRejectedValue(new HttpError(404, "gone"));
    await act(() => queryClient.invalidateQueries({ queryKey: BOARD_KEY }));
    await waitFor(() =>
      expect(env.onClosed).toHaveBeenCalledWith("demo-missing"),
    );
    expect(env.finish).not.toHaveBeenCalled();
  });

  it("stays on the last step and reports an error when finish fails", async () => {
    const { env, board } = setup({
      finish: vi.fn().mockRejectedValue(new Error("down")),
    });
    await heading("board");
    for (const title of ["demo-tasks", "my-tasks", "move-task"]) {
      next();
      await heading(title);
    }
    act(() => board(demoBoard({ apiDone: true })));
    await heading("unblocked");
    next();
    await heading("mcp");
    fireEvent.click(screen.getByRole("button", { name: "finish" }));

    await waitFor(() => expect(env.onError).toHaveBeenCalledWith("finish"));
    expect(await heading("mcp")).toBeInTheDocument();
    expect(env.onClosed).not.toHaveBeenCalled();
    expect(env.leaveDemo).not.toHaveBeenCalled();
  });

  it("closes without a tour when start fails", async () => {
    const { env } = setup({
      start: vi.fn().mockRejectedValue(new Error("409")),
    });
    await waitFor(() => expect(env.onClosed).toHaveBeenCalledWith("error"));
    expect(env.onError).toHaveBeenCalledWith("start");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
