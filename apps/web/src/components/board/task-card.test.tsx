import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import "@/lib/i18n";
import type { BoardTask } from "./model";
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

const task = (column: BoardTask["column"]) =>
  boardTaskFixture(column, { column, status: column });

const frame = (id: string) =>
  document.querySelector<HTMLElement>(`a[href$='#${id}']`)!.closest("article")!;

const renderBoard = () =>
  render(
    <TaskBoard
      boardTasks={[task("todo"), task("doing"), task("review"), task("done")]}
      lanes={[]}
      workspaceId="w"
      olderDoneCount={0}
      view="all"
      onViewChange={() => {}}
      userId="me"
    />,
  );

describe("task card fade", () => {
  it("fades a done card and leaves open cards untouched", () => {
    renderBoard();
    expect([...frame("done").classList]).toEqual(
      expect.arrayContaining(["opacity-55", "grayscale-35"]),
    );
    for (const column of ["todo", "doing", "review"] as const) {
      const classes = [...frame(column).classList];
      expect(classes).not.toContain("opacity-55");
      expect(classes).not.toContain("grayscale-35");
      expect(classes).not.toContain("hover:opacity-100");
    }
  });

  it("restores full opacity and colour when the card is acted on", () => {
    renderBoard();
    expect([...frame("done").classList]).toEqual(
      expect.arrayContaining([
        "hover:opacity-100",
        "hover:grayscale-0",
        "focus-within:opacity-100",
        "focus-within:grayscale-0",
        "data-highlighted:opacity-100",
        "data-highlighted:grayscale-0",
      ]),
    );
  });

  it("animates opacity and filter, and not at all under motion-reduce", () => {
    renderBoard();
    for (const id of ["todo", "done"]) {
      const classes = [...frame(id).classList];
      expect(classes).toContain(
        "transition-[border-color,box-shadow,opacity,filter]",
      );
      expect(classes).toContain("motion-reduce:transition-none");
    }
  });
});
