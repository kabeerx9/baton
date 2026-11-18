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
import { STEP_IDS } from "./tour-steps";
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
  const els: HTMLElement[] = [];
  const add = (attrs: Record<string, string>) => {
    const el = document.createElement("div");
    Object.assign(el.dataset, attrs);
    // jsdom has no layout; a target needs a size to count as on screen.
    el.getBoundingClientRect = () =>
      ({
        top: 10,
        left: 10,
        width: 120,
        height: 40,
        right: 130,
        bottom: 50,
      }) as DOMRect;
    document.body.append(el);
    els.push(el);
    return el;
  };
  for (const tour of [
    "board-columns",
    "nav-my-tasks",
    "my-tasks-hero",
    "nav-board",
    "nav-settings",
  ]) {
    add({ tour });
  }
  for (const key of ["design-review", "api-endpoint", "write-tests"] as const) {
    const card = add({ tour: "task-card", tourTask: TASK_IDS[key] });
    // The card's inline status button.
    const button = document.createElement("div");
    button.dataset.tour = "status-menu";
    button.getBoundingClientRect = card.getBoundingClientRect;
    card.append(button);
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

/** Clicks Next until `step` shows. Never walks past an interactive step. */
async function walkTo(step: string) {
  for (;;) {
    const current = STEP_IDS.find((id) =>
      screen.queryByRole("heading", { name: `steps.${id}.title` }),
    );
    if (current === step) return;
    if (!current) {
      await heading(STEP_IDS[0]);
      continue;
    }
    const after = STEP_IDS[STEP_IDS.indexOf(current) + 1];
    if (!after) throw new Error(`no step ${step}`);
    next();
    await heading(after);
  }
}

describe("TourRunner", () => {
  it("walks every step, advancing the interactive one on data, not on a click", async () => {
    const { env, board } = setup();

    expect(await heading("welcome")).toBeInTheDocument();
    await waitFor(() =>
      expect(env.goTo).toHaveBeenLastCalledWith("demo", "board"),
    );
    // A sidebar step leaves the page only on Next, and the next step explains
    // the new page.
    await walkTo("nav-my-tasks");
    expect(env.goTo).toHaveBeenLastCalledWith("demo", "board");
    next();
    expect(await heading("my-tasks-intro")).toBeInTheDocument();
    await waitFor(() =>
      expect(env.goTo).toHaveBeenLastCalledWith("demo", "my-tasks"),
    );
    await walkTo("nav-board");
    next();

    // Interactive step: no Next or Back, and clicking the card does nothing.
    expect(await heading("move-task")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "back" })).toBeNull();
    fireEvent.click(targets[6] as HTMLElement);
    expect(
      screen.getByRole("heading", { name: "steps.move-task.title" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(env.goTo).toHaveBeenLastCalledWith("demo", "board"),
    );

    // The query cache says the task is done: the tour moves on its own.
    act(() => board(demoBoard({ apiDone: true })));
    expect(await heading("unblocked")).toBeInTheDocument();
    next();
    expect(await heading("nav-settings")).toBeInTheDocument();
    next();

    expect(await heading("mcp")).toBeInTheDocument();
    await waitFor(() =>
      expect(env.goTo).toHaveBeenLastCalledWith("demo", "agents"),
    );
    fireEvent.click(screen.getByRole("button", { name: "finish" }));

    await waitFor(() => expect(env.finish).toHaveBeenCalledWith("finished"));
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="finish-break"]'),
      ).not.toBeNull(),
    );
    await waitFor(() => expect(env.leaveDemo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(env.onClosed).toHaveBeenCalledWith("finished"), {
      timeout: 3000,
    });
    expect(vi.mocked(env.leaveDemo).mock.calls[0]?.[0]).toMatchObject({
      demoWorkspaceId: "demo",
      originWorkspaceId: "real",
    });
  });

  describe("the status step", () => {
    const DETAIL = "/dashboard/workspace/demo/project/p1/task/id-api-endpoint";
    const doneWrite = (queryClient: QueryClient, shape: "menu" | "bar") =>
      queryClient
        .getMutationCache()
        .build(queryClient, {
          mutationFn: async () => ({ outcome: "applied" }),
        })
        .execute(
          shape === "menu"
            ? { taskId: TASK_IDS["api-endpoint"], status: "done" }
            : { id: TASK_IDS["api-endpoint"], status: "done" },
        );

    it("advances the moment the inline status menu's write succeeds", async () => {
      const { queryClient } = setup();
      await walkTo("nav-board");
      next();
      await heading("move-task");
      // The board is never refetched or updated: only the write says so.
      await act(async () => {
        await doneWrite(queryClient, "menu");
      });
      expect(await heading("unblocked")).toBeInTheDocument();
    });

    it("follows the user to the task page and advances there without going back", async () => {
      const bar = document.createElement("div");
      bar.dataset.tour = "status-bar";
      bar.getBoundingClientRect = targets[0]!.getBoundingClientRect;
      document.body.append(bar);
      targets.push(bar);

      const { env, queryClient } = setup({ pathname: DETAIL });
      await walkTo("nav-board");
      next();
      // On the task page the step stays, with its Done instruction.
      expect(await heading("move-task")).toBeInTheDocument();
      await waitFor(() =>
        expect(env.goTo).toHaveBeenLastCalledWith("demo", "board"),
      );
      vi.mocked(env.goTo).mockClear();
      await new Promise((r) => setTimeout(r, 400));
      expect(env.goTo).not.toHaveBeenCalled();

      // The detail query says done; the board is untouched.
      act(() =>
        queryClient.setQueryData(["task", TASK_IDS["api-endpoint"]], {
          status: "done",
        }),
      );
      expect(await heading("unblocked")).toBeInTheDocument();
      // Off a status step, the tour brings the user back to the board.
      await waitFor(() =>
        expect(env.goTo).toHaveBeenLastCalledWith("demo", "board"),
      );
    });

    it("reads the task cache without becoming one of its observers", async () => {
      // A query observer with no queryFn logs "No queryFn" on each render
      // and overwrites the task page's options for the shared query.
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const { queryClient } = setup({ pathname: DETAIL });
      await walkTo("nav-board");
      next();
      await heading("move-task");
      act(() =>
        queryClient.setQueryData(["task", TASK_IDS["api-endpoint"]], {
          status: "done",
        }),
      );
      expect(await heading("unblocked")).toBeInTheDocument();
      const taskQuery = queryClient
        .getQueryCache()
        .find({ queryKey: ["task", TASK_IDS["api-endpoint"]] });
      expect(taskQuery?.getObserversCount()).toBe(0);
      expect(
        errors.mock.calls.some((call) => String(call[0]).includes("queryFn")),
      ).toBe(false);
      errors.mockRestore();
    });

    it("advances from the detail bar's write too", async () => {
      const { queryClient } = setup({ pathname: DETAIL });
      await walkTo("nav-board");
      next();
      await heading("move-task");
      await act(async () => {
        await doneWrite(queryClient, "bar");
      });
      expect(await heading("unblocked")).toBeInTheDocument();
    });

    it("ignores a request for approval: the task is not done yet", async () => {
      const { queryClient } = setup();
      await walkTo("nav-board");
      next();
      await heading("move-task");
      await act(async () => {
        await queryClient
          .getMutationCache()
          .build(queryClient, {
            mutationFn: async () => ({ outcome: "requested" }),
          })
          .execute({ taskId: TASK_IDS["api-endpoint"], status: "done" });
      });
      expect(await heading("move-task")).toBeInTheDocument();
    });
  });

  it("moves on when the user clicks the sidebar link a step points at", async () => {
    setup();
    await walkTo("nav-my-tasks");
    fireEvent.click(targets[1] as HTMLElement);
    expect(await heading("my-tasks-intro")).toBeInTheDocument();
  });

  it("goes Back one step", async () => {
    setup();
    await heading("welcome");
    next();
    await heading("board-columns");
    fireEvent.click(screen.getByRole("button", { name: "back" }));
    expect(await heading("welcome")).toBeInTheDocument();
  });

  it("skips on any step after a confirmation, without the animation", async () => {
    const { env } = setup();
    await heading("welcome");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByText("skipConfirm.title")).toBeInTheDocument();
    // Escape again goes back to the step.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(await heading("welcome")).toBeInTheDocument();
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
    await heading("welcome");
    act(() => board(demoBoard({ without: "write-tests" })));
    await waitFor(() =>
      expect(env.onClosed).toHaveBeenCalledWith("demo-missing"),
    );
    expect(env.finish).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes quietly when the demo workspace is gone", async () => {
    const { env, queryClient } = setup();
    await heading("welcome");
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
    await heading("welcome");
    await walkTo("nav-board");
    next();
    await heading("move-task");
    act(() => board(demoBoard({ apiDone: true })));
    await heading("unblocked");
    next();
    await heading("nav-settings");
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
