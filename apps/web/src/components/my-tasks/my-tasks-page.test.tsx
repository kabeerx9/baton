import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import { MyTasksPage } from "./my-tasks-page";
import { assigned, dueIn, link } from "./test-task";

const mocks = vi.hoisted(() => ({
  getAssignedTasks: vi.fn(),
  updateStatus: vi.fn(),
  updateDueDate: vi.fn(),
  toast: {
    success: vi.fn(
      (_title: string, _options?: { action?: { onClick: () => void } }) =>
        "toast-done",
    ),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/fetchers/task/get-assigned-tasks", () => ({
  default: mocks.getAssignedTasks,
}));
vi.mock("@/fetchers/task/update-task-status", () => ({
  default: mocks.updateStatus,
}));
vi.mock("@/fetchers/task/update-task-due-date", () => ({
  default: mocks.updateDueDate,
}));
vi.mock("@/fetchers/board/get-board", () => ({
  default: () =>
    Promise.resolve({
      projects: [{ id: "p-board", kind: "board" }],
      members: [],
    }),
}));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params: _params,
    to: _to,
    ...props
  }: PropsWithChildren<{ params: unknown; to: string }>) => (
    <a href="/task" {...props}>
      {children}
    </a>
  ),
}));

const today = new Date();
today.setHours(0, 0, 0, 0);
const day = today.getTime();

const late = assigned("late", {
  number: 41,
  title: "Fix the crash",
  status: "in-progress",
  dueDate: dueIn(day, -2),
});
const blocker = assigned("blocker", {
  number: 27,
  title: "Return 409",
  dueDate: dueIn(day, -1),
  waiting: [link("APP-61", "Priya Nair")],
});
const held = assigned("held", {
  number: 12,
  title: "Salary cap check",
  waitsOn: [link("DRF-11")],
});

let client: QueryClient;
let listed: AssignedTask[];
let total: number | undefined;

function mount() {
  return render(
    <QueryClientProvider client={client}>
      <ShortcutTestWrapper>
        <MyTasksPage workspaceId="w1" />
      </ShortcutTestWrapper>
    </QueryClientProvider>,
  );
}

const hero = () => screen.findByRole("region", { name: "Do this next" });
const heroTitle = async () =>
  within(await hero()).getByRole("heading", { level: 2 }).textContent;
const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(document.body, { key });
  });

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  listed = [late, blocker, held];
  total = undefined;
  mocks.getAssignedTasks.mockImplementation(() =>
    Promise.resolve({ tasks: listed, total: total ?? listed.length }),
  );
  // The server applies a status write: the task is gone unless it reopens.
  mocks.updateStatus.mockImplementation(
    (id: string, task: { status: string }) => {
      const before = [late, blocker, held].find((t) => t.id === id);
      listed =
        task.status === "done"
          ? listed.filter((t) => t.id !== id)
          : before
            ? [...listed, before]
            : listed;
      return Promise.resolve({ outcome: "applied", task: { id } });
    },
  );
  mocks.updateDueDate.mockImplementation((id: string, task: AssignedTask) =>
    Promise.resolve({ id, dueDate: task.dueDate }),
  );
});

afterEach(() => {
  client.clear();
  vi.clearAllMocks();
});

describe("page states", () => {
  it("shows the page's shape while the first load runs", () => {
    mocks.getAssignedTasks.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("offers a retry when the first load fails, and recovers", async () => {
    mocks.getAssignedTasks.mockRejectedValueOnce(new Error("down"));
    mount();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your tasks couldn't be loaded.");

    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await heroTitle()).toBe("Return 409");
  });

  it("keeps loaded tasks on screen when a later refresh fails", async () => {
    mount();
    await hero();
    mocks.getAssignedTasks.mockRejectedValueOnce(new Error("down"));
    await act(() => client.refetchQueries({ queryKey: ["assigned-tasks"] }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(await heroTitle()).toBe("Return 409");
  });

  it("says so when nothing is assigned", async () => {
    listed = [];
    mount();
    expect(await screen.findByText("Nothing assigned to you")).toBeVisible();
  });

  it("says how many tasks the list leaves out", async () => {
    total = 137;
    mount();
    await hero();
    expect(
      screen.getByText("Showing the first 3 of 137 tasks."),
    ).toBeInTheDocument();
  });

  it("has no truncation note when the list is whole", async () => {
    mount();
    await hero();
    expect(screen.queryByText(/Showing the first/)).not.toBeInTheDocument();
  });
});

describe("the queue", () => {
  it("puts late work that holds a teammate up first, and held work out of reach", async () => {
    mount();
    expect(await heroTitle()).toBe("Return 409");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "One teammate is waiting on you.",
    );
    expect(
      screen.queryByRole("button", {
        name: "Mark APP-12 done",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "APP-12 cannot be finished yet",
      }),
    ).toBeInTheDocument();
  });

  it("skips the next task for this visit only, without a write", async () => {
    mount();
    fireEvent.click(
      within(await hero()).getByRole("button", {
        name: /Skip/,
      }),
    );
    expect(await heroTitle()).toBe("Fix the crash");
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(mocks.updateDueDate).not.toHaveBeenCalled();
  });

  it("promotes a row with Do next", async () => {
    mount();
    await hero();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Do APP-41 next",
      }),
    );
    await waitFor(async () => expect(await heroTitle()).toBe("Fix the crash"));
  });
});

describe("mark done", () => {
  it("writes the done status, moves on at once and offers an undo", async () => {
    mount();
    fireEvent.click(
      within(await hero()).getByRole("button", {
        name: /Mark done/,
      }),
    );

    // The next task is up before the server has answered.
    expect(await heroTitle()).toBe("Fix the crash");
    await waitFor(() =>
      expect(mocks.toast.success).toHaveBeenCalledWith(
        "APP-27 done",
        expect.objectContaining({
          description: "Priya is no longer waiting on it.",
        }),
      ),
    );
    expect(mocks.updateStatus).toHaveBeenCalledWith(
      "blocker",
      expect.objectContaining({ id: "blocker", status: "done" }),
    );
  });

  it("writes the old status back on undo, and the task returns", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Mark APP-41 done" }),
    );
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalled());
    const undo = mocks.toast.success.mock.calls[0]?.[1]?.action?.onClick;
    if (!undo) throw new Error("the done toast has no undo action");

    await act(async () => undo());

    expect(mocks.updateStatus).toHaveBeenLastCalledWith(
      "late",
      expect.objectContaining({ status: "in-progress" }),
    );
    expect(
      await screen.findByRole("button", {
        name: "Mark APP-41 done",
      }),
    ).toBeInTheDocument();
  });

  it("finishes with D and reopens with Z", async () => {
    mount();
    await hero();
    press("d");
    expect(await heroTitle()).toBe("Fix the crash");
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalled());

    press("z");

    await waitFor(() =>
      expect(mocks.updateStatus).toHaveBeenLastCalledWith(
        "blocker",
        expect.objectContaining({ status: "to-do" }),
      ),
    );
    await waitFor(async () => expect(await heroTitle()).toBe("Return 409"));
  });

  it("leaves the task as it is when the change needs consent, and says a request was sent", async () => {
    mocks.updateStatus.mockResolvedValueOnce({
      outcome: "requested",
      request: { id: "r1" },
      task: { id: "blocker", userId: "u-owner" },
    });
    mount();
    fireEvent.click(
      within(await hero()).getByRole("button", {
        name: /Mark done/,
      }),
    );

    // The existing "request sent" toast, from the status mutation.
    await waitFor(() => expect(mocks.toast.info).toHaveBeenCalledTimes(1));
    expect(mocks.toast.success).not.toHaveBeenCalled();
    await waitFor(async () => expect(await heroTitle()).toBe("Return 409"));
    // Nothing was finished, so there is nothing to undo.
    press("z");
    expect(mocks.updateStatus).toHaveBeenCalledTimes(1);
  });

  it("brings the task back and shows the server's reason when the write is refused", async () => {
    mocks.updateStatus.mockRejectedValueOnce(
      new Error("The task is blocked and cannot be finished"),
    );
    mount();
    fireEvent.click(
      within(await hero()).getByRole("button", {
        name: /Mark done/,
      }),
    );

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "The task is blocked and cannot be finished",
      ),
    );
    expect(mocks.toast.success).not.toHaveBeenCalled();
    await waitFor(async () => expect(await heroTitle()).toBe("Return 409"));
  });

  it("shows a feature again and says why, when the list still holds it after the write", async () => {
    // The write is applied, but the task stays open: it has open tasks under it.
    mocks.updateStatus.mockResolvedValueOnce({
      outcome: "applied",
      task: { id: "blocker" },
    });
    mount();
    fireEvent.click(
      within(await hero()).getByRole("button", {
        name: /Mark done/,
      }),
    );

    await waitFor(() =>
      expect(mocks.toast.info).toHaveBeenCalledWith(
        "APP-27 stays open. It closes when the tasks under it are done.",
      ),
    );
    // The "done" toast was wrong for this task, so it is taken back.
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("toast-done");
    await waitFor(async () => expect(await heroTitle()).toBe("Return 409"));
  });

  it("keeps the undo after the last task is cleared", async () => {
    listed = [late];
    mount();
    await hero();
    press("d");
    expect(await screen.findByText("You cleared the list.")).toBeVisible();

    press("z");

    expect(await heroTitle()).toBe("Fix the crash");
  });
});

describe("move", () => {
  it("writes the new due date and shows it before the server answers", async () => {
    let answer: (value: unknown) => void = () => {};
    mocks.updateDueDate.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    mount();
    fireEvent.click(
      within(await hero()).getByRole("button", {
        name: "Move",
      }),
    );
    fireEvent.click(await screen.findByText("Today", { selector: "button" }));

    await waitFor(() => expect(mocks.updateDueDate).toHaveBeenCalledTimes(1));
    const [id, sent] = mocks.updateDueDate.mock.calls[0] ?? [];
    expect(id).toBe("blocker");
    expect(new Date(sent.dueDate).getTime()).toBe(day);
    // The card shows the new date while the write is still in flight.
    await waitFor(async () =>
      expect(within(await hero()).getByText("Today")).toBeInTheDocument(),
    );
    expect(
      within(await hero()).queryByText("1d overdue"),
    ).not.toBeInTheDocument();
    await act(async () => answer({ id: "blocker", dueDate: sent.dueDate }));
  });

  it("puts the server's date back and says so when the write fails", async () => {
    mocks.updateDueDate.mockRejectedValueOnce(new Error("No access"));
    mount();
    fireEvent.click(
      within(await hero()).getByRole("button", {
        name: "Move",
      }),
    );
    fireEvent.click(await screen.findByText("Today", { selector: "button" }));

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("No access"),
    );
    await waitFor(async () => expect(await heroTitle()).toBe("Return 409"));
  });
});
