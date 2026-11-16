import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import { TaskStatusBar } from "./task-status-bar";

const mocks = vi.hoisted(() => ({
  columns: undefined as unknown,
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: mocks.columns,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.toastError } }));

const column = (
  slug: string,
  name: string,
  position: number,
  isFinal = false,
) => ({
  id: `id-${slug}`,
  slug,
  name,
  position,
  isFinal,
  icon: null,
});
const task = (status: string) =>
  ({ id: "t1", projectId: "p1", status }) as Task;

beforeEach(() => {
  mocks.columns = [
    column("to-do", "To do", 0),
    column("in-progress", "In progress", 1),
    column("qa", "QA", 2),
    column("shipped", "Shipped", 3, true),
  ];
  mocks.mutateAsync.mockReset();
  mocks.toastError.mockReset();
});

const checked = () =>
  screen
    .queryAllByRole("radio")
    .filter((r) => r.getAttribute("aria-checked") === "true");

describe("TaskStatusBar", () => {
  it("shows one step per project column and checks the current one", () => {
    render(<TaskStatusBar task={task("qa")} blocked={false} />);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(checked().map((r) => r.textContent)).toEqual(["QA"]);
  });

  it("checks nothing for a status no column knows, and says so", () => {
    render(<TaskStatusBar task={task("legacy-status")} blocked={false} />);
    expect(checked()).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toBe(
      "tasks:hero.status.unknown",
    );
  });

  it("writes the column slug through the one status mutation", async () => {
    mocks.mutateAsync.mockResolvedValue({ outcome: "applied" });
    render(<TaskStatusBar task={task("to-do")} blocked={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /QA/ }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      id: "t1",
      status: "qa",
    });
  });

  it("stays on the current step when the server only opens a change request", async () => {
    mocks.mutateAsync.mockResolvedValue({ outcome: "requested" });
    render(<TaskStatusBar task={task("to-do")} blocked={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /In progress/ }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
    expect(checked().map((r) => r.textContent)).toEqual(["To do"]);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("shows the server's refusal and keeps the step", async () => {
    mocks.mutateAsync.mockRejectedValue(new Error("Blocked by an open task"));
    render(<TaskStatusBar task={task("to-do")} blocked={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /Shipped/ }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Blocked by an open task"),
    );
    expect(checked().map((r) => r.textContent)).toEqual(["To do"]);
  });

  it("does not offer the current status again", () => {
    render(<TaskStatusBar task={task("qa")} blocked={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /QA/ }));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("locks the final step while blocked", () => {
    render(<TaskStatusBar task={task("to-do")} blocked />);
    expect(
      screen.getByRole("radio", { name: /Shipped/ }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("moves focus with arrows without writing", () => {
    render(<TaskStatusBar task={task("to-do")} blocked={false} />);
    const first = screen.getByRole("radio", { name: /To do/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("gives the status shortcut one target", () => {
    const { container } = render(
      <TaskStatusBar task={task("qa")} blocked={false} />,
    );
    const targets = container.querySelectorAll('[data-task-action="status"]');
    expect(targets).toHaveLength(1);
    expect(targets[0]?.textContent).toBe("QA");
  });

  it("follows the server: a new status in the cache moves the bar", () => {
    const { rerender } = render(
      <TaskStatusBar task={task("to-do")} blocked={false} />,
    );
    rerender(<TaskStatusBar task={task("shipped")} blocked={false} />);
    expect(checked().map((r) => r.textContent)).toEqual(["Shipped"]);
  });

  it("says when statuses cannot load", () => {
    mocks.columns = undefined;
    render(<TaskStatusBar task={task("to-do")} blocked={false} />);
    expect(screen.getByText("tasks:hero.status.loading")).toBeTruthy();
  });
});
