import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Button } from "@/components/ui/button";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { HttpError } from "@/lib/http-error";
import { toast } from "@/lib/toast";
import { useTaskStatusStore } from "@/store/task-status/store";
import type Task from "@/types/task";
import { StatusRequestModal } from "./change-request/status-request-modal";
import { TaskStatusBar } from "./detail/status-bar/task-status-bar";
import SubtaskStatusPopover from "./subtask-status-popover";
import TaskStatusPopover from "./task-status-popover";

vi.mock("@/fetchers/task/update-task-status", () => ({ default: vi.fn() }));
vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => true }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: [
      { id: "1", slug: "to-do", name: "To do", position: 0, isFinal: false },
      {
        id: "2",
        slug: "in-progress",
        name: "In progress",
        position: 1,
        isFinal: false,
      },
      { id: "3", slug: "shipped", name: "Shipped", position: 2, isFinal: true },
    ],
    isLoading: false,
    isError: false,
  }),
}));

const put = vi.mocked(updateTaskStatus);

const task = (id: string, move?: string, status = "to-do"): Task => ({
  id,
  title: `Task ${id}`,
  number: 1,
  description: null,
  status,
  statusGeneration: 3,
  statusChange: move ? { move } : undefined,
  priority: null,
  startDate: null,
  dueDate: null,
  position: null,
  createdAt: "",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "p",
});

/** Each PUT waits until the test answers it. */
let answers: Record<string, (outcome: "applied" | "requested") => void>;
let sent: string[];

beforeEach(() => {
  vi.clearAllMocks();
  answers = {};
  sent = [];
  put.mockImplementation(
    (id, body) =>
      new Promise((resolve) => {
        sent.push(`${id}:${body.status}`);
        answers[id] = (outcome) =>
          resolve(
            outcome === "applied"
              ? ({
                  outcome,
                  task: { id, statusGeneration: 4 },
                } as never)
              : ({ outcome, request: { id: "r" }, task: { id } } as never),
          );
      }),
  );
});

function wrap(ui: ReactNode) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      {ui}
      <StatusRequestModal />
    </QueryClientProvider>,
  );
}

const checked = () =>
  screen
    .queryAllByRole("radio")
    .filter((r) => r.getAttribute("aria-checked") === "true")
    .map((r) => r.textContent);

describe("status bar", () => {
  it("moves at once when the server says the move applies, and keeps the next click open", async () => {
    wrap(<TaskStatusBar task={task("a", "apply")} blocked={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /In progress/ }));
    await waitFor(() => expect(checked()).toEqual(["In progress"]));
    // The next click is not held back by the first one.
    fireEvent.click(screen.getByRole("radio", { name: /Shipped/ }));
    await waitFor(() => expect(checked()).toEqual(["Shipped"]));
    expect(sent).toEqual(["a:in-progress"]);

    await act(async () => answers.a!("applied"));
    await waitFor(() => expect(sent).toEqual(["a:in-progress", "a:shipped"]));
    expect(checked()).toEqual(["Shipped"]);
  });

  it("goes back to the server value and toasts once when the write is refused", async () => {
    put.mockRejectedValueOnce(new HttpError(409, "Waiting on API-3."));
    wrap(<TaskStatusBar task={task("a", "apply")} blocked={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /In progress/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Waiting on API-3."),
    );
    expect(checked()).toEqual(["To do"]);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("keeps the finishing step disabled while blocked", () => {
    wrap(<TaskStatusBar task={task("a", "apply")} blocked />);
    expect(screen.getAllByRole("radio")[2]).toBeDisabled();
  });

  it("disables the controls for a denied move, and for a task with an unresolved write", () => {
    wrap(<TaskStatusBar task={task("a", "deny")} blocked={false} />);
    for (const radio of screen.getAllByRole("radio"))
      expect(radio).toHaveAttribute("aria-disabled", "true");
  });

  it("locks the task after a timeout, until a read unlocks it", async () => {
    put.mockRejectedValueOnce(
      new DOMException("signal timed out", "TimeoutError"),
    );
    wrap(<TaskStatusBar task={task("a", "apply")} blocked={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /In progress/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(checked()).toEqual(["To do"]);
    for (const radio of screen.getAllByRole("radio"))
      expect(radio).toHaveAttribute("aria-disabled", "true");
    expect(put).toHaveBeenCalledTimes(1);
  });
});

describe("the request modal", () => {
  it("opens once for a request move, leaves the status alone and sends on confirm", async () => {
    wrap(
      <>
        <TaskStatusBar task={task("a", "request")} blocked={false} />
        <TaskStatusPopover task={task("a", "request")}>
          <Button>Status</Button>
        </TaskStatusPopover>
      </>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /In progress/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("tasks:changeRequest.confirmTitle"),
    ).toBeVisible();
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(checked()).toEqual(["To do"]);
    expect(put).not.toHaveBeenCalled();
    // The other control of the same task is shut while the modal holds it.
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(screen.queryByRole("option")).toBeNull();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "tasks:changeRequest.confirmSend",
      }),
    );
    // Loading state in the modal while the request flies.
    expect(
      await within(dialog).findByRole("button", {
        name: "tasks:changeRequest.confirmSending",
      }),
    ).toBeDisabled();
    expect(sent).toEqual(["a:in-progress"]);
    expect(checked()).toEqual(["To do"]);

    await act(async () => answers.a!("requested"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(checked()).toEqual(["To do"]);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("sends nothing on cancel and unlocks the task", async () => {
    wrap(<TaskStatusBar task={task("a", "request")} blocked={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /In progress/ }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common:actions.cancel" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(put).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(useTaskStatusStore.getState().entries).toEqual({});
  });

  it("treats a task with no prediction as a request", async () => {
    wrap(<TaskStatusBar task={task("a")} blocked={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /In progress/ }));
    expect(await screen.findByRole("alertdialog")).toBeVisible();
    expect(put).not.toHaveBeenCalled();
  });
});

describe("the request modal and the workspace", () => {
  const inWorkspace = (id: string, ui: ReactNode) => (
    <QueryClientProvider client={client}>
      {ui}
      <StatusRequestModal workspaceId={id} />
    </QueryClientProvider>
  );
  const client = new QueryClient();

  it("closes and sends nothing when the workspace changes", async () => {
    const bar = <TaskStatusBar task={task("a", "request")} blocked={false} />;
    const { rerender } = render(inWorkspace("w1", bar));
    fireEvent.click(screen.getByRole("radio", { name: /In progress/ }));
    expect(await screen.findByRole("alertdialog")).toBeVisible();

    rerender(inWorkspace("w2", bar));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(put).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(useTaskStatusStore.getState().entries).toEqual({});
  });

  it("keeps the modal open when the workspace does not change", async () => {
    const bar = <TaskStatusBar task={task("a", "request")} blocked={false} />;
    const { rerender } = render(inWorkspace("w1", bar));
    fireEvent.click(screen.getByRole("radio", { name: /In progress/ }));
    expect(await screen.findByRole("alertdialog")).toBeVisible();
    rerender(inWorkspace("w1", bar));
    expect(screen.getByRole("alertdialog")).toBeVisible();
  });

  it("describes several statuses in the plural", async () => {
    wrap(
      <SubtaskStatusPopover
        tasks={[task("b", "request"), task("d", "request")]}
        projectId="p"
      >
        <Button>Status</Button>
      </SubtaskStatusPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    fireEvent.click(await screen.findByRole("option", { name: /Shipped/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("tasks:changeRequest.confirmDescriptionMany"),
    ).toBeVisible();
  });
});

describe("popover triggers that cannot open", () => {
  it("shows a denied task's trigger disabled and opens nothing", () => {
    wrap(
      <TaskStatusPopover task={task("a", "deny")}>
        <Button>Status</Button>
      </TaskStatusPopover>,
    );
    const trigger = screen.getByRole("button", { name: "Status" });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(trigger);
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("shows the bulk trigger disabled when every task is denied", () => {
    wrap(
      <SubtaskStatusPopover tasks={[task("a", "deny")]} projectId="p">
        <Button>Status</Button>
      </SubtaskStatusPopover>,
    );
    expect(screen.getByRole("button", { name: "Status" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows the trigger disabled while a write holds the task", async () => {
    put.mockRejectedValueOnce(
      new DOMException("signal timed out", "TimeoutError"),
    );
    wrap(
      <>
        <TaskStatusBar task={task("a", "apply")} blocked={false} />
        <TaskStatusPopover task={task("a", "apply")}>
          <Button>Status</Button>
        </TaskStatusPopover>
      </>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /In progress/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Status" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("bulk status popover", () => {
  const tasks = [task("a", "apply"), task("b", "request"), task("c", "apply")];

  const choose = async (name: RegExp) => {
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    fireEvent.click(await screen.findByRole("option", { name }));
  };

  it("moves the apply tasks at once and lists the request tasks in one modal", async () => {
    wrap(
      <SubtaskStatusPopover tasks={tasks} projectId="p">
        <Button>Status</Button>
      </SubtaskStatusPopover>,
    );
    await choose(/In progress/);
    expect(sent.sort()).toEqual(["a:in-progress", "c:in-progress"]);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Task b")).toBeVisible();
    expect(within(dialog).queryByText("Task a")).toBeNull();
    expect(useTaskStatusStore.getState().entries.a?.kind).toBe("sending");
  });

  it("skips only the request tasks on cancel", async () => {
    wrap(
      <SubtaskStatusPopover tasks={tasks} projectId="p">
        <Button>Status</Button>
      </SubtaskStatusPopover>,
    );
    await choose(/Shipped/);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common:actions.cancel" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(sent.sort()).toEqual(["a:shipped", "c:shipped"]);
    expect(useTaskStatusStore.getState().entries.b).toBeUndefined();
    await act(async () => {
      answers.a!("applied");
      answers.c!("applied");
    });
    // The callers settled without an error toast.
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("sends the request tasks on confirm", async () => {
    wrap(
      <SubtaskStatusPopover tasks={tasks} projectId="p">
        <Button>Status</Button>
      </SubtaskStatusPopover>,
    );
    await choose(/Shipped/);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "tasks:changeRequest.confirmSend",
      }),
    );
    await waitFor(() => expect(sent).toContain("b:shipped"));
    expect(sent.sort()).toEqual(["a:shipped", "b:shipped", "c:shipped"]);
  });
});
