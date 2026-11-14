/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The ancestor elements stand in for a clickable card or row around a popup;
   they are probes, not interactive UI. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "./menu";
import { expectPopupContainment } from "./popup-containment-test-utils";
import { POPUP_RESET } from "./popup-reset";

// Library names. Section 4 of the migration record lists the renames: the
// content slot `menu-popup` becomes `menu-content` and the trigger state
// `data-popup-open` becomes `data-open`. The other parts keep their slot.
const SLOT = {
  content: "menu-content",
  subContent: "menu-content",
};
const OPEN_ATTR = "data-open";
// Prop rename inside the wrapper contract (record section 4, rule 3 and the
// C2 brief): `closeOnClick` becomes `closeOnSelect`.
const keepOpenProps = { closeOnSelect: false };

/** The open menus, outermost first. UI SDK keeps closed content in the page. */
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

async function openByClick(trigger: HTMLElement) {
  press(trigger);
  await waitFor(() => expect(openMenus()).toHaveLength(1));
  // Both libraries move focus into the popup after it opens. A key sent before
  // that lands on the trigger and loses to the focus move.
  await waitFor(() =>
    expect(openMenus()[0]?.contains(document.activeElement)).toBe(true),
  );
}

async function expectClosed() {
  await waitFor(() => expect(openMenus()).toHaveLength(0));
}

function highlighted() {
  return document.querySelector<HTMLElement>("[data-highlighted]");
}

function BasicMenu({
  onFirst = () => {},
  onSecond = () => {},
  onOpenChange,
  disabledSecond = false,
}: {
  onFirst?: () => void;
  onSecond?: () => void;
  onOpenChange?: (open: boolean, details: { reason: string }) => void;
  disabledSecond?: boolean;
}) {
  return (
    <Menu onOpenChange={onOpenChange}>
      <MenuTrigger>Actions</MenuTrigger>
      <MenuPopup>
        <MenuItem onClick={onFirst}>Rename</MenuItem>
        <MenuItem disabled={disabledSecond} onClick={onSecond}>
          Delete
        </MenuItem>
        <MenuItem>Archive</MenuItem>
      </MenuPopup>
    </Menu>
  );
}

describe("Menu parity", () => {
  it("exposes the menu button pattern roles and names", async () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuPopup>
          <MenuItem>Rename</MenuItem>
          <MenuCheckboxItem checked value="pinned">
            Pinned
          </MenuCheckboxItem>
          <MenuRadioGroup value="b">
            <MenuRadioItem value="a">Alpha</MenuRadioItem>
            <MenuRadioItem value="b">Beta</MenuRadioItem>
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>,
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute(OPEN_ATTR);

    await openByClick(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute(OPEN_ATTR);
    expect(openMenus()[0]).toHaveAttribute("data-slot", SLOT.content);
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeVisible();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Pinned" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Beta" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("menuitemradio", { name: "Alpha" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("opens on click, reports a boolean and a reason, and Escape returns focus", async () => {
    const onOpenChange = vi.fn();
    render(<BasicMenu onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Actions" });

    await openByClick(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ reason: expect.any(String) }),
    );

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await expectClosed();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
    expect(trigger).toHaveFocus();
  });

  it("closes on a press outside", async () => {
    render(<BasicMenu />);
    await openByClick(screen.getByRole("button", { name: "Actions" }));

    fireEvent.pointerDown(document.body, { pointerType: "mouse" });
    fireEvent.mouseDown(document.body);
    fireEvent.pointerUp(document.body, { pointerType: "mouse" });
    fireEvent.mouseUp(document.body);
    fireEvent.click(document.body);
    await expectClosed();
  });

  it("opens from the keyboard and moves focus into the menu", async () => {
    render(<BasicMenu />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();

    // Enter on a native button: the browser clicks it unless keydown was
    // cancelled, so `key` clicks only in that case.
    key(trigger, "Enter");
    await waitFor(() => expect(openMenus()).toHaveLength(1));
    await waitFor(() =>
      expect(openMenus()[0]?.contains(document.activeElement)).toBe(true),
    );
  });

  it("opens with ArrowDown on the trigger", async () => {
    render(<BasicMenu />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => expect(openMenus()).toHaveLength(1));
    await waitFor(() =>
      expect(openMenus()[0]?.contains(document.activeElement)).toBe(true),
    );
  });

  it("runs the item's onClick on click and closes the menu", async () => {
    const onFirst = vi.fn();
    render(<BasicMenu onFirst={onFirst} />);
    await openByClick(screen.getByRole("button", { name: "Actions" }));

    press(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onFirst).toHaveBeenCalledTimes(1);
    await expectClosed();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus(),
    );
  });

  it("runs the item's onClick on Enter and on Space from the keyboard", async () => {
    const onFirst = vi.fn();
    render(<BasicMenu onFirst={onFirst} />);
    await openByClick(screen.getByRole("button", { name: "Actions" }));

    const item = screen.getByRole("menuitem", { name: "Rename" });
    item.focus();
    fireEvent.keyDown(item, { key: "Enter" });
    fireEvent.keyUp(item, { key: "Enter" });
    await expectClosed();
    expect(onFirst).toHaveBeenCalledTimes(1);

    const trigger = screen.getByRole("button", { name: "Actions" });
    await openByClick(trigger);
    const again = screen.getByRole("menuitem", { name: "Rename" });
    again.focus();
    fireEvent.keyDown(again, { key: " " });
    fireEvent.keyUp(again, { key: " " });
    await expectClosed();
    expect(onFirst).toHaveBeenCalledTimes(2);
  });

  it("highlights the item under the pointer and follows the arrow keys", async () => {
    render(<BasicMenu />);
    await openByClick(screen.getByRole("button", { name: "Actions" }));

    const rename = screen.getByRole("menuitem", { name: "Rename" });
    const archive = screen.getByRole("menuitem", { name: "Archive" });

    fireEvent.pointerMove(archive, { pointerType: "mouse" });
    fireEvent.mouseMove(archive);
    fireEvent.pointerEnter(archive, { pointerType: "mouse" });
    fireEvent.mouseEnter(archive);
    await waitFor(() => expect(highlighted()).toBe(archive));
    expect(archive).toHaveFocus();

    fireEvent.keyDown(archive, { key: "ArrowUp" });
    await waitFor(() => expect(highlighted()).not.toBe(archive));
    expect(highlighted()).not.toBeNull();
    expect(highlighted()).toHaveFocus();

    const start = highlighted() as HTMLElement;
    fireEvent.keyDown(start, { key: "Home" });
    await waitFor(() => expect(highlighted()).toBe(rename));
    fireEvent.keyDown(rename, { key: "End" });
    await waitFor(() => expect(highlighted()).toBe(archive));
  });

  it("does not run a disabled item and marks it disabled", async () => {
    const onSecond = vi.fn();
    render(<BasicMenu disabledSecond onSecond={onSecond} />);
    await openByClick(screen.getByRole("button", { name: "Actions" }));

    const disabled = screen.getByRole("menuitem", { name: "Delete" });
    expect(disabled).toHaveAttribute("data-disabled");
    expect(disabled).toHaveAttribute("aria-disabled", "true");

    press(disabled);
    fireEvent.keyDown(disabled, { key: "Enter" });
    expect(onSecond).not.toHaveBeenCalled();
    expect(openMenus()).toHaveLength(1);
  });

  it("lets arrow keys reach a disabled item and keeps it from running", async () => {
    render(<BasicMenu disabledSecond />);
    await openByClick(screen.getByRole("button", { name: "Actions" }));

    const rename = screen.getByRole("menuitem", { name: "Rename" });
    const disabled = screen.getByRole("menuitem", { name: "Delete" });
    rename.focus();
    fireEvent.keyDown(rename, { key: "ArrowDown" });
    // Base UI keeps a disabled menu item in the arrow-key order, as the menu
    // pattern asks, and shows it with aria-disabled. It is not skipped.
    await waitFor(() => expect(highlighted()).toBe(disabled));
  });

  it("disables the trigger natively and never opens", () => {
    render(
      <Menu>
        <MenuTrigger disabled>Actions</MenuTrigger>
        <MenuPopup>
          <MenuItem>Rename</MenuItem>
        </MenuPopup>
      </Menu>,
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toBeDisabled();
    expect(trigger).not.toHaveAttribute("aria-disabled", "true");
    press(trigger);
    expect(openMenus()).toHaveLength(0);
    trigger.focus();
    expect(trigger).not.toHaveFocus();
  });

  it("opens a submenu with ArrowRight and Escape closes only the submenu", async () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuPopup>
          <MenuItem>Rename</MenuItem>
          <MenuSub>
            <MenuSubTrigger>Move to</MenuSubTrigger>
            <MenuSubPopup>
              <MenuItem>Inbox</MenuItem>
              <MenuItem>Archive</MenuItem>
            </MenuSubPopup>
          </MenuSub>
        </MenuPopup>
      </Menu>,
    );
    await openByClick(screen.getByRole("button", { name: "Actions" }));

    const subTrigger = screen.getByRole("menuitem", { name: "Move to" });
    expect(subTrigger).toHaveAttribute("aria-haspopup", "menu");
    subTrigger.focus();
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" });
    await waitFor(() => expect(openMenus()).toHaveLength(2));
    expect(openMenus()[1]).toHaveAttribute("data-slot", SLOT.subContent);
    expect(subTrigger).toHaveAttribute(OPEN_ATTR);
    expect(screen.getByRole("menuitem", { name: "Inbox" })).toBeVisible();

    const inbox = screen.getByRole("menuitem", { name: "Inbox" });
    await waitFor(() => expect(inbox).toHaveFocus());
    fireEvent.keyDown(inbox, { key: "Escape" });
    await waitFor(() => expect(openMenus()).toHaveLength(1));
    await waitFor(() => expect(subTrigger).toHaveFocus());
  });

  it("toggles a checkbox item with a boolean and keeps the menu open", async () => {
    const onCheckedChange = vi.fn();
    render(
      <Menu>
        <MenuTrigger>View</MenuTrigger>
        <MenuPopup>
          <MenuCheckboxItem
            defaultChecked={false}
            onCheckedChange={onCheckedChange}
            value="pinned"
          >
            Pinned
          </MenuCheckboxItem>
        </MenuPopup>
      </Menu>,
    );
    await openByClick(screen.getByRole("button", { name: "View" }));

    const item = screen.getByRole("menuitemcheckbox", { name: "Pinned" });
    expect(item).toHaveAttribute("aria-checked", "false");
    press(item);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true);
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(openMenus()).toHaveLength(1);

    press(item);
    expect(onCheckedChange.mock.calls[1]?.[0]).toBe(false);
  });

  it("selects a radio item with its value and keeps the menu open", async () => {
    const onValueChange = vi.fn();
    render(
      <Menu>
        <MenuTrigger>Sort</MenuTrigger>
        <MenuPopup>
          <MenuRadioGroup defaultValue="a" onValueChange={onValueChange}>
            <MenuRadioItem value="a">Alpha</MenuRadioItem>
            <MenuRadioItem value="b">Beta</MenuRadioItem>
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>,
    );
    await openByClick(screen.getByRole("button", { name: "Sort" }));

    press(screen.getByRole("menuitemradio", { name: "Beta" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("b");
    expect(screen.getByRole("menuitemradio", { name: "Beta" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(openMenus()).toHaveLength(1);
  });

  it("keeps the menu open after an item that asks not to close", async () => {
    const onClick = vi.fn();
    render(
      <Menu>
        <MenuTrigger>Zoom</MenuTrigger>
        <MenuPopup>
          <MenuItem onClick={onClick} {...keepOpenProps}>
            Zoom in
          </MenuItem>
          <MenuItem>Close</MenuItem>
        </MenuPopup>
      </Menu>,
    );
    await openByClick(screen.getByRole("button", { name: "Zoom" }));

    press(screen.getByRole("menuitem", { name: "Zoom in" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(openMenus()).toHaveLength(1);

    press(screen.getByRole("menuitem", { name: "Close" }));
    await expectClosed();
  });

  it("takes the trigger as a render element and as an asChild child", async () => {
    render(
      <>
        <Menu>
          <MenuTrigger render={<button className="by-render" type="button" />}>
            Render trigger
          </MenuTrigger>
          <MenuPopup>
            <MenuItem>One</MenuItem>
          </MenuPopup>
        </Menu>
        <Menu>
          <MenuTrigger asChild>
            <button className="by-child" type="button">
              Child trigger
            </button>
          </MenuTrigger>
          <MenuPopup>
            <MenuItem>Two</MenuItem>
          </MenuPopup>
        </Menu>
      </>,
    );
    const byRender = screen.getByRole("button", { name: "Render trigger" });
    const byChild = screen.getByRole("button", { name: "Child trigger" });
    expect(byRender).toHaveClass("by-render");
    expect(byChild).toHaveClass("by-child");
    expect(byRender).toHaveAttribute("data-slot", "menu-trigger");
    expect(byChild).toHaveAttribute("data-slot", "menu-trigger");

    await openByClick(byChild);
    expect(screen.getByRole("menuitem", { name: "Two" })).toBeVisible();
  });

  it("renders item extras: separator, shortcut and the destructive variant", async () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuPopup>
          <MenuItem>
            Copy id
            <MenuShortcut>⌘C</MenuShortcut>
          </MenuItem>
          <MenuSeparator />
          <MenuItem variant="destructive">Delete</MenuItem>
        </MenuPopup>
      </Menu>,
    );
    await openByClick(screen.getByRole("button", { name: "Actions" }));

    expect(
      document.querySelector('[data-slot="menu-shortcut"]'),
    ).toHaveTextContent("⌘C");
    expect(
      document.querySelector('[data-slot="menu-separator"]'),
    ).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
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
          <Menu>
            <MenuTrigger>Actions</MenuTrigger>
            <MenuPopup>
              <MenuItem>Rename</MenuItem>
              <MenuItem>Delete</MenuItem>
            </MenuPopup>
          </Menu>
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

    it("does not submit the form on Enter or Space at the trigger", async () => {
      const onSubmit = vi.fn();
      render(<FormMenu onSubmit={onSubmit} />);
      const trigger = screen.getByRole("button", { name: "Actions" });
      trigger.focus();

      key(trigger, "Enter");
      await waitFor(() => expect(openMenus()).toHaveLength(1));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("does not submit the form on Enter at an item or on a click", async () => {
      const onSubmit = vi.fn();
      render(<FormMenu onSubmit={onSubmit} />);
      await openByClick(screen.getByRole("button", { name: "Actions" }));

      const item = screen.getByRole("menuitem", { name: "Rename" });
      item.focus();
      fireEvent.keyDown(item, { key: "Enter" });
      fireEvent.keyUp(item, { key: "Enter" });
      await expectClosed();
      expect(onSubmit).not.toHaveBeenCalled();

      await openByClick(screen.getByRole("button", { name: "Actions" }));
      press(screen.getByRole("menuitem", { name: "Delete" }));
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("popup event containment", () => {
    it("contains pointer and command events in the content", async () => {
      await expectPopupContainment({
        render: ({ containEvents, contentProps, control }) => (
          <Menu>
            <MenuTrigger>Actions</MenuTrigger>
            <MenuPopup containEvents={containEvents} {...contentProps}>
              <MenuItem>Rename</MenuItem>
              {control}
            </MenuPopup>
          </Menu>
        ),
        open: async () => {
          await openByClick(screen.getByRole("button", { name: "Actions" }));
        },
        content: () => openMenus()[0] as Element,
      });
    });

    it("contains pointer and command events in the submenu content", async () => {
      await expectPopupContainment({
        render: ({ containEvents, contentProps, control }) => (
          <Menu>
            <MenuTrigger>Actions</MenuTrigger>
            {/* The submenu sits inside its parent popup, so the parent takes
                the same switch; otherwise it would contain the click. */}
            <MenuPopup containEvents={containEvents}>
              <MenuSub>
                <MenuSubTrigger>Move to</MenuSubTrigger>
                <MenuSubPopup containEvents={containEvents} {...contentProps}>
                  <MenuItem>Inbox</MenuItem>
                  {control}
                </MenuSubPopup>
              </MenuSub>
            </MenuPopup>
          </Menu>
        ),
        open: async () => {
          await openByClick(screen.getByRole("button", { name: "Actions" }));
          const subTrigger = screen.getByRole("menuitem", { name: "Move to" });
          subTrigger.focus();
          fireEvent.keyDown(subTrigger, { key: "ArrowRight" });
          await waitFor(() => expect(openMenus()).toHaveLength(2));
        },
        content: () => openMenus()[1] as Element,
      });
    });
  });
});

// Behavior the port adds or must not lose. These run on UI SDK only: Base UI
// portals the popup, so it needed no text reset and could not leak natively.
describe("Menu on UI SDK", () => {
  it("resets inherited text styles on the popup (a menu inside a small, muted card)", async () => {
    const openTask = vi.fn();
    const onClick = vi.fn();
    render(
      <article
        className="text-xs text-muted-foreground"
        data-testid="card"
        onClick={openTask}
      >
        <Menu>
          <MenuTrigger>Status</MenuTrigger>
          <MenuPopup>
            <MenuItem onClick={onClick}>Done</MenuItem>
          </MenuPopup>
        </Menu>
      </article>,
    );
    await openByClick(screen.getByRole("button", { name: "Status" }));
    openTask.mockClear();

    // The popup starts from body text, then the item sets its own size.
    for (const token of POPUP_RESET.split(" ")) {
      expect(openMenus()[0]).toHaveClass(token);
    }
    const item = screen.getByRole("menuitem", { name: "Done" });
    expect(item).not.toHaveClass("text-xs");
    expect(item).not.toHaveClass("text-muted-foreground");

    // A click on an item changes the status and does not open the task.
    press(item);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(openTask).not.toHaveBeenCalled();
  });

  it("returns focus to the trigger after a selection, although the trigger never had focus", async () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <Menu>
          <MenuTrigger>Status</MenuTrigger>
          <MenuPopup>
            <MenuItem>Done</MenuItem>
          </MenuPopup>
        </Menu>
      </>,
    );
    // Focus sits on another control and a bare click opens the menu, as a
    // click does in Safari or a test: the trigger is never focused.
    screen.getByRole("button", { name: "Elsewhere" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    await waitFor(() => expect(openMenus()).toHaveLength(1));
    await waitFor(() =>
      expect(openMenus()[0]?.contains(document.activeElement)).toBe(true),
    );

    press(screen.getByRole("menuitem", { name: "Done" }));
    await expectClosed();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Status" })).toHaveFocus(),
    );
  });

  it("does not hold the menu open for a handler that returns a promise", async () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuPopup>
          <MenuItem onClick={() => new Promise(() => {})}>Sign out</MenuItem>
        </MenuPopup>
      </Menu>,
    );
    await openByClick(screen.getByRole("button", { name: "Actions" }));

    press(screen.getByRole("menuitem", { name: "Sign out" }));
    await expectClosed();
  });

  it("keeps a caller's onSelect running and lets it keep the menu open", async () => {
    const onClick = vi.fn();
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuPopup>
          <MenuItem
            onClick={onClick}
            onSelect={(event) => event.preventDefault()}
          >
            Stay
          </MenuItem>
        </MenuPopup>
      </Menu>,
    );
    await openByClick(screen.getByRole("button", { name: "Actions" }));

    press(screen.getByRole("menuitem", { name: "Stay" }));
    expect(openMenus()).toHaveLength(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each([
    { container: false, warns: true },
    { container: true, warns: false },
  ])(
    "inside a link: container=$container, [popup-containment] warning=$warns",
    async ({ container, warns }) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        render(
          <a href="/tasks/1">
            <Menu>
              <MenuTrigger>Status</MenuTrigger>
              <MenuPopup container={container ? document.body : undefined}>
                <MenuItem>Done</MenuItem>
              </MenuPopup>
            </Menu>
          </a>,
        );
        await openByClick(screen.getByRole("button", { name: "Status" }));
        press(screen.getByRole("menuitem", { name: "Done" }));
        expect(
          error.mock.calls.some((call) =>
            String(call[0]).includes("[popup-containment]"),
          ),
        ).toBe(warns);
      } finally {
        error.mockRestore();
      }
    },
  );
});
