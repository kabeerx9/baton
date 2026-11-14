import { mount } from "@ui-sdk/core/testing";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { boardNav } from "./board-nav";

const COLUMNS = ["todo", "doing", "review", "done"];

type Card = { key: string; column: string; index: number };

// 4 columns x 2 rows: a b c d / e f g h, one card per cell.
const CARDS: Card[] = [
  { key: "a", column: "todo", index: 0 },
  { key: "e", column: "todo", index: 1 },
  { key: "b", column: "doing", index: 0 },
  { key: "f", column: "doing", index: 1 },
  { key: "c", column: "review", index: 0 },
  { key: "g", column: "review", index: 1 },
  { key: "d", column: "done", index: 0 },
  { key: "h", column: "done", index: 1 },
];

function markup(cards: Card[]) {
  const frames = cards
    .map(
      (c) =>
        `<frame value="${c.key}" column="${c.column}" index="${c.index}" label="T-${c.key}">` +
        `<card value="${c.key}" href="#${c.key}">${c.key}</card>` +
        `<button type="button" tabindex="-1" data-inner="${c.key}">inner</button></frame>`,
    )
    .join("");
  return `<root>${frames}</root>`;
}

type Rect = { left: number; top: number; right: number; bottom: number };
type View = ReturnType<typeof open>;

function open(
  cards: Card[] = CARDS,
  options: Parameters<typeof mount<typeof boardNav>>[1] = {
    columns: COLUMNS,
  },
) {
  const view = mount(boardNav, options, markup(cards));
  return view;
}

/** jsdom has no layout: give each card link the rect the layout would. */
function layout(view: View, rects: Record<string, Rect>) {
  for (const [key, rect] of Object.entries(rects)) {
    const el = view.part("card", key)!;
    el.getBoundingClientRect = () =>
      ({
        ...rect,
        width: 100,
        height: 50,
        x: rect.left,
        y: rect.top,
      }) as DOMRect;
  }
}

const cell = (col: number, row: number): Rect => ({
  left: col * 120,
  right: col * 120 + 100,
  top: row * 60,
  bottom: row * 60 + 50,
});

// Four columns side by side.
const WIDE = {
  a: cell(0, 0),
  e: cell(0, 1),
  b: cell(1, 0),
  f: cell(1, 1),
  c: cell(2, 0),
  g: cell(2, 1),
  d: cell(3, 0),
  h: cell(3, 1),
};
// Two columns: todo and doing on the first row of columns, review and done under.
const TWO = {
  a: cell(0, 0),
  e: cell(0, 1),
  b: cell(1, 0),
  f: cell(1, 1),
  c: cell(0, 2),
  g: cell(0, 3),
  d: cell(1, 2),
  h: cell(1, 3),
};

let current: View | undefined;
const show = (view: View) => (current = view);
afterEach(() => current?.unmount());

const focused = () => document.activeElement?.getAttribute("href");
const tabbable = (view: View) =>
  CARDS.filter((c) => view.part("card", c.key)!.tabIndex === 0).map(
    (c) => c.key,
  );

describe("tab stop", () => {
  it("gives exactly one card link tabindex 0: the first in document order", () => {
    const view = show(open());
    expect(tabbable(view)).toEqual(["a"]);
    expect(
      CARDS.every((c) => view.part("card", c.key)!.hasAttribute("tabindex")),
    ).toBe(true);
  });

  it("moves the one tab stop with focus", async () => {
    const view = show(open());
    layout(view, WIDE);
    view.part("card", "a")!.focus();
    await view.keys("ArrowRight");
    expect(tabbable(view)).toEqual(["b"]);
  });

  it("returns to the last card used when Tab comes back", async () => {
    const view = show(open());
    layout(view, WIDE);
    view.part("card", "a")!.focus();
    await view.keys("ArrowRight", "ArrowRight");
    expect(focused()).toBe("#c");
    (document.activeElement as HTMLElement).blur();
    await view.keys("Tab");
    expect(focused()).toBe("#c");
  });
});

describe("arrow keys follow the layout", () => {
  it("four columns: left and right change column, up and down change row", async () => {
    const view = show(open());
    layout(view, WIDE);
    view.part("card", "a")!.focus();
    await view.keys("ArrowRight");
    expect(focused()).toBe("#b");
    await view.keys("ArrowDown");
    expect(focused()).toBe("#f");
    await view.keys("ArrowRight", "ArrowRight");
    expect(focused()).toBe("#h");
    await view.keys("ArrowUp");
    expect(focused()).toBe("#d");
    await view.keys("ArrowLeft");
    expect(focused()).toBe("#c");
  });

  it("two columns: down from the last card of the top row reaches the row below", async () => {
    const view = show(open());
    layout(view, TWO);
    view.part("card", "f")!.focus();
    await view.keys("ArrowDown");
    expect(focused()).toBe("#d");
    await view.keys("ArrowLeft");
    expect(focused()).toBe("#c");
    await view.keys("ArrowUp");
    expect(focused()).toBe("#e");
  });

  it("Home and End go to the first and last card in document order", async () => {
    const view = show(open());
    layout(view, WIDE);
    view.part("card", "f")!.focus();
    await view.keys("End");
    expect(focused()).toBe("#h");
    await view.keys("Home");
    expect(focused()).toBe("#a");
  });

  it("does not loop and leaves the key alone at an edge", async () => {
    const view = show(open());
    layout(view, WIDE);
    const a = view.part("card", "a")!;
    a.focus();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    });
    a.dispatchEvent(event);
    expect(focused()).toBe("#a");
    expect(event.defaultPrevented).toBe(false);
  });

  it("prevents the default only when focus moved", async () => {
    const view = show(open());
    layout(view, WIDE);
    const a = view.part("card", "a")!;
    a.focus();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    a.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves Alt, Ctrl and Cmd arrows to other shortcuts", async () => {
    const view = show(open());
    layout(view, WIDE);
    const a = view.part("card", "a")!;
    a.focus();
    for (const mod of ["altKey", "ctrlKey", "metaKey"] as const) {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        [mod]: true,
        bubbles: true,
        cancelable: true,
      });
      a.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(focused()).toBe("#a");
    }
  });
});

describe("step (j and k)", () => {
  it("moves down and up from the card that holds the target", () => {
    const view = show(open());
    layout(view, WIDE);
    view.part("card", "a")!.focus();
    expect(view.api.step("down", document.activeElement)).toBe("moved");
    expect(focused()).toBe("#e");
    expect(view.api.step("up", document.activeElement)).toBe("moved");
    expect(focused()).toBe("#a");
  });

  it("starts from a card's inner control too", () => {
    const view = show(open());
    layout(view, WIDE);
    const inner = view.root.querySelector<HTMLElement>("[data-inner='a']")!;
    inner.focus();
    expect(view.api.step("down", inner)).toBe("moved");
    expect(focused()).toBe("#e");
  });

  it("does nothing at the end of a column or from outside the board", () => {
    const view = show(open());
    layout(view, WIDE);
    view.part("card", "e")!.focus();
    expect(view.api.step("down", document.activeElement)).toBe("stayed");
    expect(view.api.step("down", document.body)).toBe("outside");
    expect(focused()).toBe("#e");
  });

  it("focusCurrent enters the board on the tab stop", async () => {
    const view = show(open());
    layout(view, WIDE);
    view.part("card", "a")!.focus();
    await view.keys("ArrowRight");
    (document.activeElement as HTMLElement).blur();
    view.api.focusCurrent();
    expect(focused()).toBe("#b");
  });
});

describe("Escape from an inner control", () => {
  const press = (el: Element, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
      ...init,
    });
    el.dispatchEvent(event);
    return event;
  };

  it("returns focus to that card's link", () => {
    const view = show(open());
    const inner = view.root.querySelector<HTMLElement>("[data-inner='b']")!;
    inner.focus();
    const event = press(inner);
    expect(focused()).toBe("#b");
    expect(event.defaultPrevented).toBe(true);
  });

  it("is not handled on the card link", () => {
    const view = show(open());
    const card = view.part("card", "b")!;
    card.focus();
    expect(press(card).defaultPrevented).toBe(false);
  });

  it("is left alone inside an open menu", () => {
    const view = show(open());
    const frame = view.root.querySelector("[data-inner='b']")!.parentElement!;
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    const item = document.createElement("button");
    item.setAttribute("role", "menuitem");
    menu.append(item);
    frame.append(menu);
    item.focus();
    const event = press(item);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(item);
  });

  it("is left alone when another handler already used it", () => {
    const view = show(open());
    const inner = view.root.querySelector<HTMLElement>("[data-inner='b']")!;
    inner.focus();
    inner.addEventListener("keydown", (e) => e.preventDefault(), {
      once: true,
    });
    // Native listeners run before the primitive's; the frame sees a prevented event.
    press(inner);
    expect(document.activeElement).toBe(inner);
  });
});
