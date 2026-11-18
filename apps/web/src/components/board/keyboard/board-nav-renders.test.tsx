import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import "@/lib/i18n";
import { TaskBoard } from "../task-board";
import type { BoardTask } from "../model";
import { boardTaskFixture } from "../test-fixtures";

const renders = vi.hoisted(() => ({
  cards: new Map<string, number>(),
  columns: 0,
}));

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
vi.mock("../new-task-dialog", () => ({ NewTaskDialog: () => null }));
// The status menu sits inside each card's frame. It re-renders exactly when its
// card does, so counting it counts card renders.
vi.mock("../status-menu", () => ({
  StatusMenu: ({ taskId }: { taskId: string }) => {
    renders.cards.set(taskId, (renders.cards.get(taskId) ?? 0) + 1);
    return null;
  },
}));
vi.mock("../board-column", async (original) => {
  const real = await original<typeof import("../board-column")>();
  return {
    BoardColumn: (props: Parameters<typeof real.BoardColumn>[0]) => {
      renders.columns += 1;
      return real.BoardColumn(props);
    },
  };
});

const task = (n: number, column: BoardTask["column"]) =>
  boardTaskFixture(`t-${n}`, { column, status: column });
// A board of 4 columns x 10 cards.
const TASKS = (["todo", "doing", "review", "done"] as const).flatMap(
  (column, c) =>
    Array.from({ length: 10 }, (_, r) => task(c * 10 + r + 1, column)),
);

const link = (n: number) =>
  document.querySelector<HTMLAnchorElement>(`a[href$='#t-${n}']`)!;
const total = () => [...renders.cards.values()].reduce((a, b) => a + b, 0);
const touched = (before: Map<string, number>) =>
  [...renders.cards]
    .filter(([id, n]) => n !== (before.get(id) ?? 0))
    .map(([id]) => id);

beforeEach(() => {
  renders.cards.clear();
  renders.columns = 0;
});
afterEach(cleanup);

describe("render cost of a focus move", () => {
  it("renders every card once at the start", () => {
    render(
      <TaskBoard
        boardTasks={TASKS}
        lanes={[]}
        workspaceId="w"
        olderDoneCount={0}
        view="all"
        onViewChange={() => {}}
        userId="me"
      />,
    );
    expect(renders.cards.size).toBe(40);
    expect(total()).toBe(40);
  });

  it("re-renders at most the two cards involved, and no column", () => {
    render(
      <TaskBoard
        boardTasks={TASKS}
        lanes={[]}
        workspaceId="w"
        olderDoneCount={0}
        view="all"
        onViewChange={() => {}}
        userId="me"
      />,
    );
    const stubRects = () =>
      document
        .querySelectorAll<HTMLElement>("section")
        .forEach((section, column) =>
          section
            .querySelectorAll<HTMLElement>("a[data-slot='board-nav-card']")
            .forEach((el, row) => {
              const left = column * 300;
              const top = row * 100;
              el.getBoundingClientRect = () =>
                ({ left, top, right: left + 280, bottom: top + 80 }) as DOMRect;
            }),
        );
    stubRects();
    link(1).focus();
    const before = new Map(renders.cards);
    const columnsBefore = renders.columns;

    fireEvent.keyDown(link(1), { key: "ArrowDown" });
    expect(document.activeElement).toBe(link(2));
    expect(touched(before).sort()).toEqual(["t-1", "t-2"]);

    const beforeSecond = new Map(renders.cards);
    fireEvent.keyDown(link(2), { key: "ArrowRight" });
    expect(document.activeElement).toBe(link(12));
    expect(touched(beforeSecond).sort()).toEqual(["t-12", "t-2"]);
    // Neither the board nor any column re-rendered.
    expect(renders.columns).toBe(columnsBefore);
  });
});
