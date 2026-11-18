import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import "@/lib/i18n";
import type { Person } from "./model";
import { TaskBoard } from "./task-board";
import { boardTaskFixture } from "./test-fixtures";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params?: { taskId?: string };
    children?: ReactNode;
  }) => (
    <a href={`${to}#${params?.taskId ?? ""}`} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/queries/board/use-board-member-name", () => ({
  useBoardMemberName: () => () => null,
}));
vi.mock("./new-task-dialog", () => ({ NewTaskDialog: () => null }));
vi.mock("./status-menu", () => ({ StatusMenu: () => null }));

const me: Person = { id: "me", name: "Me", initials: "M", hue: 0, image: null };
const tasks = [
  boardTaskFixture("mine", { assignee: me }),
  boardTaskFixture("theirs", { column: "doing", status: "doing" }),
];

const renderBoard = (
  view: "all" | "mine",
  onViewChange = (_view: "all" | "mine") => {},
) =>
  render(
    <TaskBoard
      boardTasks={tasks}
      lanes={[]}
      workspaceId="w"
      olderDoneCount={4}
      view={view}
      onViewChange={onViewChange}
      userId="me"
    />,
  );

describe("TaskBoard view", () => {
  it("shows every card and the older-done line for all", () => {
    renderBoard("all");
    expect(document.querySelectorAll("article")).toHaveLength(2);
    expect(screen.getByText(/4 older/)).toBeTruthy();
  });

  it("shows only my cards, hides the older-done line and says so when a column is empty", () => {
    renderBoard("mine");
    expect(document.querySelectorAll("article")).toHaveLength(1);
    expect(screen.queryByText(/older/)).toBeNull();
    expect(screen.getAllByText("Nothing of yours here").length).toBe(3);
  });

  it("asks the caller for the other view", () => {
    const onViewChange = vi.fn();
    renderBoard("all", onViewChange);
    fireEvent.click(screen.getByRole("radio", { name: "My tasks" }));
    expect(onViewChange).toHaveBeenCalledWith("mine");
  });
});
