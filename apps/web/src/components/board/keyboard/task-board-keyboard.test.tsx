import {
  act,
  cleanup,
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
import "@/lib/i18n";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import { shortcutRegistry } from "@/lib/shortcuts/registry";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { TaskBoard } from "../task-board";
import type { BoardTask } from "../model";
import { boardTaskFixture } from "../test-fixtures";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params: _params,
    children,
    ...props
  }: {
    to: string;
    params?: unknown;
    children?: ReactNode;
  }) => (
    <a
      href={`${to}#${(_params as { taskId?: string } | undefined)?.taskId ?? ""}`}
      {...props}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/queries/board/use-board-member-name", () => ({
  useBoardMemberName: () => () => null,
}));
vi.mock("@/hooks/mutations/board/use-set-status", () => ({
  useSetStatus: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("../new-task-dialog", () => ({ NewTaskDialog: () => null }));

const task = (
  n: number,
  column: BoardTask["column"],
  over: Partial<BoardTask> = {},
) => boardTaskFixture(`t-${n}`, { column, status: column, ...over });

// todo: 1 2 | doing: 3 | review: 4 5 | done: 6
const TASKS = [
  task(1, "todo"),
  task(2, "todo"),
  task(3, "doing"),
  task(4, "review"),
  task(5, "review"),
  task(6, "done"),
];

function board(tasks: BoardTask[]) {
  return (
    <ShortcutTestWrapper>
      <button type="button">outside</button>
      <TaskBoard boardTasks={tasks} lanes={[]} workspaceId="w1" />
    </ShortcutTestWrapper>
  );
}

const links = () => [
  ...document.querySelectorAll<HTMLAnchorElement>(
    "a[data-slot='board-nav-card']",
  ),
];
const link = (n: number) =>
  document.querySelector<HTMLAnchorElement>(`a[href$='#t-${n}']`)!;
const focusedId = () =>
  document.activeElement?.getAttribute("href")?.split("#")[1];
const press = (el: Element, key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(el, { key, ...init });

type Layout = "wide" | "narrow";
/** jsdom has no layout. Place each card where a 4 or 2 column grid would. */
function layout(kind: Layout) {
  const sections = [...document.querySelectorAll("section")];
  sections.forEach((section, column) => {
    const cards = section.querySelectorAll<HTMLElement>(
      "a[data-slot='board-nav-card']",
    );
    cards.forEach((el, row) => {
      const left = kind === "wide" ? column * 300 : (column % 2) * 300;
      const top =
        (kind === "wide" ? 0 : Math.floor(column / 2) * 400) + 40 + row * 100;
      el.getBoundingClientRect = () =>
        ({
          left,
          top,
          right: left + 280,
          bottom: top + 80,
          width: 280,
          height: 80,
          x: left,
          y: top,
        }) as DOMRect;
    });
  });
}

const announced = () =>
  document.querySelector("[data-ui-sdk-announcer='']")?.textContent ?? "";

beforeEach(() => {
  shortcutRegistry.reset();
  // The live region outlives a test; start each one with a fresh region.
  document
    .querySelectorAll("[data-ui-sdk-announcer]")
    .forEach((el) => el.remove());
});
afterEach(() => cleanup());

describe("tab stop and inner controls", () => {
  it("gives exactly one card link tabindex 0", () => {
    render(board(TASKS));
    expect(links()).toHaveLength(6);
    expect(
      links()
        .filter((a) => a.tabIndex === 0)
        .map((a) => a.getAttribute("href")),
    ).toEqual([expect.stringMatching(/#t-1$/)]);
  });

  it("makes only the active card's inner controls tabbable, and they follow the stop", () => {
    render(board(TASKS));
    layout("wide");
    const statusButtons = () =>
      screen.getAllByRole("button", { name: /Change status/ });
    expect(statusButtons().map((b) => b.tabIndex)).toEqual([
      0, -1, -1, -1, -1, -1,
    ]);
    link(1).focus();
    press(link(1), "ArrowRight");
    expect(focusedId()).toBe("t-3");
    expect(statusButtons().map((b) => b.tabIndex)).toEqual([
      -1, -1, 0, -1, -1, -1,
    ]);
  });

  it("names the board, the columns and each card's position", () => {
    render(board(TASKS));
    expect(
      screen.getByRole("group", { name: /Board\. Use the arrow keys/ }),
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "In review" })).toBeTruthy();
    expect(link(5).textContent).toContain("In review, 2 of 2");
    expect(link(1).textContent).toContain("To do, 1 of 2");
  });
});

describe("arrow keys on the real board", () => {
  it.each(["wide", "narrow"] as const)("%s layout follows the grid", (kind) => {
    render(board(TASKS));
    layout(kind);
    link(1).focus();
    press(link(1), "ArrowDown");
    expect(focusedId()).toBe("t-2");
    press(link(2), "ArrowRight");
    expect(focusedId()).toBe("t-3");
    if (kind === "wide") {
      press(link(3), "ArrowRight");
      expect(focusedId()).toBe("t-4");
      press(link(4), "ArrowDown");
      expect(focusedId()).toBe("t-5");
      press(link(5), "ArrowRight");
      expect(focusedId()).toBe("t-6");
    } else {
      // 2 columns: todo | doing, then review | done underneath.
      press(link(3), "ArrowDown");
      expect(focusedId()).toBe("t-6");
      press(link(6), "ArrowLeft");
      expect(focusedId()).toBe("t-4");
      press(link(4), "ArrowDown");
      expect(focusedId()).toBe("t-5");
      press(link(5), "ArrowUp");
      expect(focusedId()).toBe("t-4");
      press(link(4), "ArrowUp");
      expect(focusedId()).toBe("t-2");
    }
    press(document.activeElement!, "Home");
    expect(focusedId()).toBe("t-1");
    press(document.activeElement!, "End");
    expect(focusedId()).toBe("t-6");
  });
});

describe("shortcuts still work with focus on a card", () => {
  function Probe({ spy }: { spy: (id: string) => void }) {
    useShortcut("goToHome", () => spy("g h"));
    useShortcut("createTask", () => spy("c"));
    useShortcut("openShortcuts", () => spy("?"));
    useShortcut("openCommandMenu", () => spy("mod+k"));
    return null;
  }

  it("runs g h, c, ? and mod+k", () => {
    const spy = vi.fn();
    render(
      <>
        <Probe spy={spy} />
        {board(TASKS)}
      </>,
    );
    link(1).focus();
    press(link(1), "g");
    press(link(1), "h");
    press(link(1), "c");
    press(link(1), "?", { shiftKey: true });
    press(link(1), "k", { ctrlKey: true });
    expect(spy.mock.calls.map((c) => c[0])).toEqual(["g h", "c", "?", "mod+k"]);
  });

  it("does not stop Enter, so the link opens the task", () => {
    render(board(TASKS));
    link(1).focus();
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    link(1).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(link(1).getAttribute("href")).toContain("task/$taskId#t-1");
  });

  it("j and k step down and up from a card", () => {
    render(board(TASKS));
    layout("wide");
    link(1).focus();
    press(link(1), "j");
    expect(focusedId()).toBe("t-2");
    press(link(2), "k");
    expect(focusedId()).toBe("t-1");
  });

  it("j from outside the board enters it on the tab stop", () => {
    render(board(TASKS));
    layout("wide");
    link(1).focus();
    press(link(1), "ArrowRight");
    screen.getByRole("button", { name: "outside" }).focus();
    press(screen.getByRole("button", { name: "outside" }), "j");
    expect(focusedId()).toBe("t-3");
  });

  it("an arrow handled by a card does not also fire nextTask", () => {
    render(board(TASKS));
    layout("wide");
    link(1).focus();
    // ArrowDown: the card moves focus to t-2 once. nextTask must not move it again.
    press(link(1), "ArrowDown");
    expect(focusedId()).toBe("t-2");
  });
});

describe("StatusMenu inside a card", () => {
  it("keeps its own arrows and Escape; the second Escape returns to the card link", async () => {
    render(board(TASKS));
    layout("wide");
    link(1).focus();
    const trigger = screen.getAllByRole("button", { name: /Change status/ })[0];
    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    const items = () => screen.getAllByRole("menuitem");
    expect(items().length).toBeGreaterThan(1);
    await waitFor(() =>
      expect(menu.contains(document.activeElement)).toBe(true),
    );
    // Arrow keys belong to the menu: the board must not move focus to another card.
    press(document.activeElement!, "ArrowDown");
    expect(links().some((a) => a === document.activeElement)).toBe(false);
    // First Escape closes the menu and leaves focus on its trigger.
    press(document.activeElement!, "Escape");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    // Second Escape: back to the card link.
    press(trigger, "Escape");
    expect(document.activeElement).toBe(link(1));
  });
});

describe("focus recovery after realtime updates", () => {
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

  it("follows a card that moved to another column, and announces it", async () => {
    const view = render(board(TASKS));
    layout("wide");
    link(3).focus();
    view.rerender(
      board(TASKS.map((t) => (t.id === "t-3" ? task(3, "review") : t))),
    );
    await settle();
    expect(focusedId()).toBe("t-3");
    expect(link(3).closest("section")?.getAttribute("aria-labelledby")).toBe(
      screen.getByRole("heading", { name: "In review" }).id,
    );
    await waitFor(() => expect(announced()).toBe("T-3 moved to In review"));
  });

  it("lands on the card now at the same place when the focused card is removed", async () => {
    const view = render(board(TASKS));
    link(4).focus();
    view.rerender(board(TASKS.filter((t) => t.id !== "t-4")));
    await settle();
    expect(focusedId()).toBe("t-5");
    await waitFor(() =>
      expect(announced()).toBe("T-4 is no longer on the board"),
    );
  });

  it("lands on the last card of the column when the last card is removed", async () => {
    const view = render(board(TASKS));
    link(5).focus();
    view.rerender(board(TASKS.filter((t) => t.id !== "t-5")));
    await settle();
    expect(focusedId()).toBe("t-4");
  });

  it("goes to the nearest column on the right, then left, when a column empties", async () => {
    const view = render(board(TASKS));
    link(3).focus();
    view.rerender(board(TASKS.filter((t) => t.id !== "t-3")));
    await settle();
    expect(focusedId()).toBe("t-4");

    view.rerender(board(TASKS.filter((t) => t.id !== "t-3")));
    link(6).focus();
    view.rerender(board(TASKS.filter((t) => !["t-3", "t-6"].includes(t.id))));
    await settle();
    expect(focusedId()).toBe("t-4");
  });

  it("keeps focus on a card that is reordered inside its column", async () => {
    const view = render(board(TASKS));
    link(5).focus();
    // t-5 becomes urgent: it sorts above t-4 in the same column.
    view.rerender(
      board(
        TASKS.map((t) =>
          t.id === "t-5" ? task(5, "review", { priority: "urgent" }) : t,
        ),
      ),
    );
    await settle();
    const order = [
      ...document
        .querySelectorAll("section")[2]
        .querySelectorAll("a[data-slot='board-nav-card']"),
    ].map((a) => a.getAttribute("href")?.split("#")[1]);
    expect(order).toEqual(["t-5", "t-4"]);
    await waitFor(() => expect(focusedId()).toBe("t-5"));
  });

  it("does not take focus from another part of the page, and says nothing", async () => {
    const view = render(board(TASKS));
    const outside = screen.getByRole("button", { name: "outside" });
    outside.focus();
    view.rerender(board(TASKS.filter((t) => t.id !== "t-4")));
    await settle();
    expect(document.activeElement).toBe(outside);
    await new Promise((r) => setTimeout(r, 150));
    expect(announced()).toBe("");
  });

  it("says nothing when the whole board leaves the page", async () => {
    const view = render(board(TASKS));
    link(4).focus();
    view.unmount();
    await settle();
    await new Promise((r) => setTimeout(r, 150));
    expect(announced()).toBe("");
  });

  it("does not take focus from an open menu", async () => {
    const view = render(board(TASKS));
    const trigger = screen.getAllByRole("button", { name: /Change status/ })[3];
    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    await waitFor(() =>
      expect(menu.contains(document.activeElement)).toBe(true),
    );
    const inMenu = document.activeElement;
    view.rerender(board(TASKS.filter((t) => t.id !== "t-1")));
    await settle();
    expect(document.activeElement).toBe(inMenu);
  });
});
