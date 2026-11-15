/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The area and the ancestor elements stand in for a row or card around a popup;
   they are probes, not interactive UI. */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./context-menu";
import { expectPopupContainment } from "./popup-containment-test-utils";
import { POPUP_RESET } from "./popup-reset";

// UI SDK slot names (record section 4). Content and submenu content are
// `menu-content`, the trigger state is `data-open`, and every other part takes
// the name of the menu part it is: `menu-item`, `menu-separator`,
// `menu-checkbox-item`.
const SLOT = {
  content: "menu-content",
  subContent: "menu-content",
};
const OPEN_ATTR = "data-open";

/** A point on the viewport, where a right click or a long press happened. */
const AT = { clientX: 40, clientY: 60 };

function openMenus() {
  return [...document.querySelectorAll<HTMLElement>('[role="menu"]')].filter(
    (menu) => !menu.hasAttribute("data-closed") && !menu.hidden,
  );
}

/** A real mouse press: pointer and mouse events, then the click. */
function press(element: Element) {
  fireEvent.pointerDown(element, { pointerType: "mouse", button: 0 });
  fireEvent.mouseDown(element, { button: 0 });
  fireEvent.pointerUp(element, { pointerType: "mouse", button: 0 });
  fireEvent.mouseUp(element, { button: 0 });
  fireEvent.click(element, { button: 0 });
}

/**
 * A key press the way a browser runs it. jsdom does not turn Enter or Space on
 * a native button into a click, so this does: it fires the click only when the
 * keydown was not cancelled. A library that cancels the keydown and handles the
 * key itself therefore gets no extra click, and a library that does nothing
 * gets the browser's click. Returns whether a click was fired.
 */
function key(element: Element, name: string) {
  const proceed = fireEvent.keyDown(element, { key: name });
  let clicked = false;
  if (name === " ") {
    fireEvent.keyUp(element, { key: name });
  }
  if (
    proceed &&
    element instanceof HTMLButtonElement &&
    (name === "Enter" || name === " ")
  ) {
    clicked = true;
    fireEvent.click(element);
  }
  return clicked;
}

/** Right-clicks the area with the secondary button at a viewport point. */
function rightClick(element: Element, at = AT) {
  fireEvent.contextMenu(element, { button: 2, ...at });
}

async function openByRightClick(element: Element, at = AT) {
  rightClick(element, at);
  await waitFor(() => expect(openMenus()).toHaveLength(1));
  // Both libraries move focus into the popup after it opens. A key sent before
  // that lands on the area and loses to the focus move.
  await waitFor(() =>
    expect(openMenus()[0]?.contains(document.activeElement)).toBe(true),
  );
  return openMenus()[0] as HTMLElement;
}

async function expectClosed() {
  await waitFor(() => expect(openMenus()).toHaveLength(0));
}

function highlighted() {
  return document.querySelector<HTMLElement>("[data-highlighted]");
}

/** A row with a context menu, as `task-relations.tsx` renders one. */
function RowMenu({
  onOpenTask = () => {},
  onRemove = () => {},
  onOpenChange,
  disabledRemove = false,
}: {
  onOpenTask?: () => void;
  onRemove?: () => void;
  onOpenChange?: (open: boolean) => void;
  disabledRemove?: boolean;
}) {
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger asChild>
        <div data-testid="area">Task row</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onOpenTask}>Open task</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={disabledRemove} onClick={onRemove}>
          Remove relation
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

describe("ContextMenu parity", () => {
  it("exposes the menu roles and names for every part", async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-testid="area">Task row</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuLabel>Actions</ContextMenuLabel>
            <ContextMenuItem>
              Open task
              <ContextMenuShortcut>⏎</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuCheckboxItem checked value="pinned">
              Pinned
            </ContextMenuCheckboxItem>
            <ContextMenuRadioGroup value="related">
              <ContextMenuRadioItem value="related">
                Related
              </ContextMenuRadioItem>
              <ContextMenuRadioItem value="blocks">Blocks</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
            <ContextMenuSeparator />
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>,
    );

    const menu = await openByRightClick(screen.getByTestId("area"));
    expect(menu).toHaveAttribute("data-slot", SLOT.content);
    expect(menu).toHaveAttribute("data-open");
    expect(screen.getByRole("menuitem", { name: /Open task/ })).toBeVisible();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Pinned" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "Related" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "Blocks" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(document.querySelector('[data-slot$="separator"]')).not.toBeNull();
  });

  it("opens on a right click, marks the area, and reports a boolean", async () => {
    const onOpenChange = vi.fn();
    render(<RowMenu onOpenChange={onOpenChange} />);
    const area = screen.getByTestId("area");

    expect(openMenus()).toHaveLength(0);
    await openByRightClick(area);
    expect(area).toHaveAttribute(OPEN_ATTR);
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());
  });

  it("right-clicks again at another point and keeps one menu open", async () => {
    render(<RowMenu />);
    const area = screen.getByTestId("area");
    await openByRightClick(area);

    // A second right click inside the same area repositions the open menu
    // rather than stacking a second one.
    rightClick(area, { clientX: 200, clientY: 300 });
    await waitFor(() => expect(openMenus()).toHaveLength(1));
  });

  it("closes on Escape and puts focus back where it was", async () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <RowMenu />
      </>,
    );
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    await openByRightClick(screen.getByTestId("area"));

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await expectClosed();
    await waitFor(() => expect(elsewhere).toHaveFocus());
  });

  it("closes on a press outside", async () => {
    render(<RowMenu />);
    await openByRightClick(screen.getByTestId("area"));

    fireEvent.pointerDown(document.body, { pointerType: "mouse" });
    fireEvent.mouseDown(document.body);
    fireEvent.pointerUp(document.body, { pointerType: "mouse" });
    fireEvent.mouseUp(document.body);
    fireEvent.click(document.body);
    await expectClosed();
  });

  it("opens on a long press on touch", async () => {
    render(<RowMenu />);
    const area = screen.getByTestId("area");

    // A touch produces both events, so both libraries get their own.
    fireEvent.pointerDown(area, {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      button: 0,
      ...AT,
    });
    fireEvent.touchStart(area, {
      touches: [{ identifier: 1, ...AT }],
      changedTouches: [{ identifier: 1, ...AT }],
      targetTouches: [{ identifier: 1, ...AT }],
    });
    await waitFor(() => expect(openMenus()).toHaveLength(1), {
      timeout: 2000,
    });
  });

  it("runs the item's onClick once on a click and closes", async () => {
    const onOpenTask = vi.fn();
    render(<RowMenu onOpenTask={onOpenTask} />);
    await openByRightClick(screen.getByTestId("area"));

    press(screen.getByRole("menuitem", { name: "Open task" }));
    expect(onOpenTask).toHaveBeenCalledTimes(1);
    await expectClosed();
  });

  it("runs the item's onClick once on Enter and once on Space", async () => {
    const onOpenTask = vi.fn();
    render(<RowMenu onOpenTask={onOpenTask} />);

    await openByRightClick(screen.getByTestId("area"));
    const byEnter = screen.getByRole("menuitem", { name: "Open task" });
    byEnter.focus();
    // The item is not a native button: `key` fires no click here, so only the
    // menu's own key handling can run the handler.
    expect(key(byEnter, "Enter")).toBe(false);
    await expectClosed();
    expect(onOpenTask).toHaveBeenCalledTimes(1);

    await openByRightClick(screen.getByTestId("area"));
    const bySpace = screen.getByRole("menuitem", { name: "Open task" });
    bySpace.focus();
    fireEvent.keyDown(bySpace, { key: " " });
    fireEvent.keyUp(bySpace, { key: " " });
    await expectClosed();
    expect(onOpenTask).toHaveBeenCalledTimes(2);
  });

  it("does not run a disabled item, by pointer or by key", async () => {
    const onRemove = vi.fn();
    render(<RowMenu disabledRemove onRemove={onRemove} />);
    await openByRightClick(screen.getByTestId("area"));

    const disabled = screen.getByRole("menuitem", { name: "Remove relation" });
    expect(disabled).toHaveAttribute("data-disabled");
    expect(disabled).toHaveAttribute("aria-disabled", "true");

    press(disabled);
    key(disabled, "Enter");
    key(disabled, " ");
    expect(onRemove).not.toHaveBeenCalled();
    expect(openMenus()).toHaveLength(1);
  });

  it("moves the highlight with the arrow keys", async () => {
    render(<RowMenu />);
    await openByRightClick(screen.getByTestId("area"));

    const first = screen.getByRole("menuitem", { name: "Open task" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    await waitFor(() =>
      expect(highlighted()).toBe(
        screen.getByRole("menuitem", { name: "Remove relation" }),
      ),
    );
    fireEvent.keyDown(highlighted() as HTMLElement, { key: "Home" });
    await waitFor(() => expect(highlighted()).toBe(first));
  });

  it("opens a submenu with ArrowRight and Escape closes only the submenu", async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-testid="area">Task row</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Open task</ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Inbox</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>,
    );
    await openByRightClick(screen.getByTestId("area"));

    const subTrigger = screen.getByRole("menuitem", { name: "Move to" });
    expect(subTrigger).toHaveAttribute("aria-haspopup", "menu");
    subTrigger.focus();
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" });
    await waitFor(() => expect(openMenus()).toHaveLength(2));
    expect(openMenus()[1]).toHaveAttribute("data-slot", SLOT.subContent);
    expect(subTrigger).toHaveAttribute(OPEN_ATTR);

    const inbox = screen.getByRole("menuitem", { name: "Inbox" });
    await waitFor(() => expect(inbox).toHaveFocus());
    fireEvent.keyDown(inbox, { key: "Escape" });
    await waitFor(() => expect(openMenus()).toHaveLength(1));
    await waitFor(() => expect(subTrigger).toHaveFocus());
  });

  it("toggles a checkbox item with a boolean and keeps the menu open", async () => {
    const onCheckedChange = vi.fn();
    render(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-testid="area">Task row</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuCheckboxItem
            defaultChecked={false}
            onCheckedChange={onCheckedChange}
            value="pinned"
          >
            Pinned
          </ContextMenuCheckboxItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    await openByRightClick(screen.getByTestId("area"));

    const item = screen.getByRole("menuitemcheckbox", { name: "Pinned" });
    press(item);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true);
    expect(openMenus()).toHaveLength(1);
  });

  it("selects a radio item with its value and keeps the menu open", async () => {
    const onValueChange = vi.fn();
    render(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-testid="area">Task row</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuRadioGroup
            defaultValue="related"
            onValueChange={onValueChange}
          >
            <ContextMenuRadioItem value="related">Related</ContextMenuRadioItem>
            <ContextMenuRadioItem value="blocks">Blocks</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
        </ContextMenuContent>
      </ContextMenu>,
    );
    await openByRightClick(screen.getByTestId("area"));

    press(screen.getByRole("menuitemradio", { name: "Blocks" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("blocks");
    expect(
      screen.getByRole("menuitemradio", { name: "Blocks" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(openMenus()).toHaveLength(1);
  });

  it("takes the area from children, from asChild and from render", async () => {
    render(
      <>
        <ContextMenu>
          <ContextMenuTrigger>
            <span data-testid="child-area">Child area</span>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>One</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="by-child" data-testid="as-child-area">
              As child area
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Two</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <ContextMenu>
          <ContextMenuTrigger
            render={<div className="by-render" data-testid="render-area" />}
          >
            Render area
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Three</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </>,
    );

    const asChild = screen.getByTestId("as-child-area");
    const byRender = screen.getByTestId("render-area");
    expect(asChild).toHaveClass("by-child");
    expect(byRender).toHaveClass("by-render");

    await openByRightClick(asChild);
    expect(screen.getByRole("menuitem", { name: "Two" })).toBeVisible();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await expectClosed();

    await openByRightClick(byRender);
    expect(screen.getByRole("menuitem", { name: "Three" })).toBeVisible();
  });

  describe("inside a form with a submit button", () => {
    function FormMenu({ onSubmit }: { onSubmit: () => void }) {
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div data-testid="area">Task row</div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Open task</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          <input aria-label="Note" />
          <button type="submit">Save</button>
        </form>
      );
    }

    it("detects a submit (negative control: the submit button submits)", () => {
      const onSubmit = vi.fn();
      render(<FormMenu onSubmit={onSubmit} />);
      press(screen.getByRole("button", { name: "Save" }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("does not submit on Enter at the area or at an item", async () => {
      const onSubmit = vi.fn();
      render(<FormMenu onSubmit={onSubmit} />);

      // The area is a div, so Enter does nothing there in either library.
      const area = screen.getByTestId("area");
      key(area, "Enter");

      await openByRightClick(area);
      const item = screen.getByRole("menuitem", { name: "Open task" });
      item.focus();
      key(item, "Enter");
      await expectClosed();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});

// Behavior the port adds or must not lose. These run on UI SDK only: Base UI
// portals the content, so it needed no text reset and could not leak natively.
describe("Context menu on UI SDK", () => {
  it("contains pointer and command events in the content", async () => {
    await expectPopupContainment({
      render: ({ containEvents, contentProps, control }) => (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div data-testid="area">Task row</div>
          </ContextMenuTrigger>
          <ContextMenuContent containEvents={containEvents} {...contentProps}>
            <ContextMenuItem>Open task</ContextMenuItem>
            {control}
          </ContextMenuContent>
        </ContextMenu>
      ),
      open: async () => {
        await openByRightClick(screen.getByTestId("area"));
      },
      content: () => openMenus()[0] as Element,
    });
  });

  it("contains pointer and command events in the submenu content", async () => {
    await expectPopupContainment({
      render: ({ containEvents, contentProps, control }) => (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div data-testid="area">Task row</div>
          </ContextMenuTrigger>
          {/* The submenu sits inside its parent popup, so the parent takes the
              same switch; otherwise it would contain the click. */}
          <ContextMenuContent containEvents={containEvents}>
            <ContextMenuItem>Open task</ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
              <ContextMenuSubContent
                containEvents={containEvents}
                {...contentProps}
              >
                <ContextMenuItem>Inbox</ContextMenuItem>
                {control}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuContent>
        </ContextMenu>
      ),
      open: async () => {
        await openByRightClick(screen.getByTestId("area"));
        const subTrigger = screen.getByRole("menuitem", { name: "Move to" });
        subTrigger.focus();
        fireEvent.keyDown(subTrigger, { key: "ArrowRight" });
        await waitFor(() => expect(openMenus()).toHaveLength(2));
      },
      content: () => openMenus()[1] as Element,
    });
  });

  it("resets inherited text styles and keeps a row click out of the content", async () => {
    const openRow = vi.fn();
    const onOpenItem = vi.fn();
    render(
      <div className="text-xs text-muted-foreground" onClick={openRow}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div data-testid="area">Task row</div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={onOpenItem}>Open task</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>,
    );
    await openByRightClick(screen.getByTestId("area"));
    openRow.mockClear();

    const content = openMenus()[0] as HTMLElement;
    for (const token of POPUP_RESET.split(" ")) {
      expect(content).toHaveClass(token);
    }
    const item = screen.getByRole("menuitem", { name: "Open task" });
    expect(item).not.toHaveClass("text-xs");
    expect(item).not.toHaveClass("text-muted-foreground");

    press(item);
    expect(onOpenItem).toHaveBeenCalledTimes(1);
    expect(openRow).not.toHaveBeenCalled();
  });

  it.each([
    { clientX: 40, clientY: 60 },
    { clientX: 300, clientY: 220 },
  ])("anchors the menu at the pointer ($clientX, $clientY)", async (at) => {
    render(<RowMenu />);
    await openByRightClick(screen.getByTestId("area"), at);

    // UI SDK positions a popup with inline `left` and `top`, and a context
    // trigger hands it the pointer as a point anchor with no size.
    const content = openMenus()[0] as HTMLElement;
    await waitFor(() =>
      expect(Number.parseFloat(content.style.left)).toBe(at.clientX),
    );
    expect(
      Math.abs(Number.parseFloat(content.style.top) - at.clientY),
    ).toBeLessThanOrEqual(10);
    cleanup();
  });

  it("warns when the content sits inside a link", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // A fragment link: the contained click still runs the browser's own
      // default action, as the record describes, without leaving the page.
      render(
        <a href="#tasks">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <span data-testid="area">Card</span>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Open task</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </a>,
      );
      await openByRightClick(screen.getByTestId("area"));
      press(screen.getByRole("menuitem", { name: "Open task" }));
      expect(
        error.mock.calls.some((call) =>
          String(call[0]).includes("[popup-containment]"),
        ),
      ).toBe(true);
    } finally {
      error.mockRestore();
    }
  });

  it("leaves the browser's own menu when the area is disabled", async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger asChild disabled>
          <div data-testid="area">Task row</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Open task</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    const area = screen.getByTestId("area");
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      ...AT,
    });
    area.dispatchEvent(event);
    expect(openMenus()).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);

    // The negative control: an enabled area does prevent the native menu.
    cleanup();
    render(<RowMenu />);
    const enabled = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      ...AT,
    });
    screen.getByTestId("area").dispatchEvent(enabled);
    await waitFor(() => expect(openMenus()).toHaveLength(1));
    expect(enabled.defaultPrevented).toBe(true);
  });
});
