/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The ancestor elements stand in for a clickable card or row around a popup;
   they are probes, not interactive UI. */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { Command, CommandInput, CommandItem, CommandList } from "./command";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./menu";
import {
  Popover,
  PopoverClose,
  PopoverCreateHandle,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";
import { expectPopupContainment } from "./popup-containment-test-utils";
import { POPUP_RESET } from "./popup-reset";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

// UI SDK names (record section 4): content slot `popover-content`, trigger state `data-open`.
const SLOT = { content: "popover-content" };
const OPEN_ATTR = "data-open";

type OpenChange = (open: boolean, details: { reason: string }) => void;

/** The open popover content. UI SDK keeps closed content in the page. */
function openPopup() {
  return (
    [
      ...document.querySelectorAll<HTMLElement>(
        `[data-slot="${SLOT.content}"]`,
      ),
    ].find((el) => !el.hasAttribute("data-closed") && !el.hidden) ?? null
  );
}

async function expectOpen() {
  await waitFor(() => expect(openPopup()).not.toBeNull());
}

async function expectClosed() {
  await waitFor(() => expect(openPopup()).toBeNull());
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
 * A key press the way a browser runs it. jsdom does not run the default action
 * of Enter or Space, so this does: a native button gets its click and a text
 * input gets implicit form submission, both only when the keydown was not
 * cancelled. A library that cancels the key and handles it itself therefore
 * gets no extra default action, and one that does nothing gets the browser's.
 * Returns whether a default action ran.
 */
function key(element: Element, name: string) {
  const proceed = fireEvent.keyDown(element, { key: name });
  if (name === " ") fireEvent.keyUp(element, { key: name });
  if (!proceed) return false;
  if (
    element instanceof HTMLButtonElement &&
    (name === "Enter" || name === " ")
  ) {
    fireEvent.click(element);
    return true;
  }
  if (
    element instanceof HTMLInputElement &&
    name === "Enter" &&
    element.form !== null
  ) {
    element.form.requestSubmit();
    return true;
  }
  return false;
}

function Basic({
  contentProps,
  onOpenChange,
  triggerProps,
  modal,
  children,
  rootProps,
}: {
  contentProps?: React.ComponentProps<typeof PopoverPopup>;
  onOpenChange?: OpenChange;
  triggerProps?: React.ComponentProps<typeof PopoverTrigger>;
  modal?: boolean;
  children?: React.ReactNode;
  rootProps?: Partial<React.ComponentProps<typeof Popover>>;
}) {
  return (
    <>
      <button type="button">Outside</button>
      <p>Empty space</p>
      <Popover modal={modal} onOpenChange={onOpenChange} {...rootProps}>
        <PopoverTrigger {...triggerProps}>Open popover</PopoverTrigger>
        <PopoverPopup {...contentProps}>
          <PopoverTitle>Task status</PopoverTitle>
          <PopoverDescription>Pick a status</PopoverDescription>
          {children ?? (
            <>
              <input aria-label="Search" />
              <PopoverClose>Done</PopoverClose>
            </>
          )}
        </PopoverPopup>
      </Popover>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: "Open popover" });
// By text: a modal popover hides the rest of the page from the role queries.
const outside = () => screen.getByText("Outside");
// A press on empty space: the browser moves no focus, so the popover returns it
// to the trigger. A press on a button would hand focus to that button.
const emptySpace = () => screen.getByText("Empty space");

/** Moves focus out of the popover the way a person does: UI SDK watches focus leaving the layer. */
function leaveFocus() {
  act(() => outside().focus());
}

async function openByClick() {
  press(trigger());
  await expectOpen();
  // Both libraries move focus into the popup after it opens.
  await waitFor(() =>
    expect(openPopup()?.contains(document.activeElement)).toBe(true),
  );
}

describe("Popover roles and trigger", () => {
  it("renders a button trigger that opens a named dialog", async () => {
    render(<Basic />);

    const button = trigger();
    expect(button).toHaveAttribute("data-slot", "popover-trigger");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(openPopup()).toBeNull();

    await openByClick();
    expect(button).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: "Task status" });
    expect(dialog).toHaveAccessibleDescription("Pick a status");
    expect(dialog).toBe(openPopup());
  });

  it("marks the trigger with its open state while open and not after", async () => {
    render(<Basic />);
    expect(trigger()).not.toHaveAttribute(OPEN_ATTR);

    await openByClick();
    expect(trigger()).toHaveAttribute(OPEN_ATTR);

    key(document.activeElement as Element, "Escape");
    await expectClosed();
    expect(trigger()).not.toHaveAttribute(OPEN_ATTR);
  });

  it("starts the content from the app's text styles", async () => {
    render(<Basic />);
    await openByClick();
    for (const token of POPUP_RESET.split(" ")) {
      expect(openPopup()).toHaveClass(token);
    }
  });

  it("applies className and tooltipStyle to the content", async () => {
    render(
      <Basic contentProps={{ className: "p-0 h-9", tooltipStyle: true }} />,
    );
    await openByClick();
    expect(openPopup()).toHaveClass("p-0", "h-9", "w-fit", "text-xs");
  });

  it("reports the requested side on the content", async () => {
    render(<Basic contentProps={{ side: "top" }} />);
    await openByClick();
    expect(openPopup()).toHaveAttribute("data-side", "top");
  });

  it("renders the trigger as the child element with asChild", async () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <a href="/somewhere">Open link</a>
        </PopoverTrigger>
        <PopoverPopup>
          <PopoverTitle>Link popover</PopoverTitle>
        </PopoverPopup>
      </Popover>,
    );
    const link = screen.getByRole("link", { name: "Open link" });
    expect(link).toHaveAttribute("data-slot", "popover-trigger");
    press(link);
    await expectOpen();
  });
});

describe("Popover open and close", () => {
  it("opens on Enter and on Space, and Escape returns focus to the trigger", async () => {
    render(<Basic />);

    act(() => trigger().focus());
    key(trigger(), "Enter");
    await expectOpen();
    key(document.activeElement as Element, "Escape");
    await expectClosed();
    await waitFor(() => expect(trigger()).toHaveFocus());

    key(trigger(), " ");
    await expectOpen();
    key(document.activeElement as Element, "Escape");
    await expectClosed();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("closes when the open trigger is pressed again", async () => {
    render(<Basic />);
    await openByClick();
    press(trigger());
    await expectClosed();
  });

  it("moves focus into the content on open and keeps the content open on an inside press", async () => {
    render(<Basic />);
    act(() => trigger().focus());
    key(trigger(), "Enter");
    await expectOpen();
    await waitFor(() =>
      expect(openPopup()?.contains(document.activeElement)).toBe(true),
    );

    press(screen.getByLabelText("Search"));
    press(screen.getByRole("dialog"));
    expect(openPopup()).not.toBeNull();
  });

  it("closes from a Close part and returns focus to the trigger", async () => {
    const onOpenChange = vi.fn();
    render(<Basic onOpenChange={onOpenChange} />);
    await openByClick();
    onOpenChange.mockClear();

    press(screen.getByRole("button", { name: "Done" }));
    await expectClosed();
    await waitFor(() => expect(trigger()).toHaveFocus());
    expect(onOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: "close-press" }),
    );
  });

  it("reports open changes as a boolean and a reason", async () => {
    const onOpenChange = vi.fn();
    render(<Basic onOpenChange={onOpenChange} />);

    press(trigger());
    await expectOpen();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ reason: "trigger-press" }),
    );

    key(document.activeElement as Element, "Escape");
    await expectClosed();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );

    press(trigger());
    await expectOpen();
    press(outside());
    await expectClosed();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "outside-press" }),
    );
  });

  it("works controlled", async () => {
    function Controlled() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <span data-testid="state">{String(open)}</span>
          <Basic rootProps={{ open, onOpenChange: setOpen }} />
        </>
      );
    }
    render(<Controlled />);
    press(trigger());
    await expectOpen();
    expect(screen.getByTestId("state")).toHaveTextContent("true");
    key(document.activeElement as Element, "Escape");
    await expectClosed();
    expect(screen.getByTestId("state")).toHaveTextContent("false");
  });
});

describe("Popover modal mode", () => {
  /** Whatever a library uses to take the rest of the page out of reach. */
  const outsideUnreachable = () => {
    for (let el: Element | null = outside(); el; el = el.parentElement) {
      if (
        (el as HTMLElement).inert ||
        el.getAttribute("aria-hidden") === "true"
      )
        return true;
    }
    return false;
  };
  const scrollLocked = () =>
    [document.documentElement, document.body].some(
      (el) => el.style.overflow === "hidden" || el.style.overflowY === "hidden",
    );

  it("modal: an outside press closes it and focus returns to the trigger", async () => {
    render(<Basic modal />);
    await openByClick();

    press(emptySpace());
    await expectClosed();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("modal: Escape closes it and focus returns to the trigger", async () => {
    render(<Basic modal />);
    await openByClick();

    key(document.activeElement as Element, "Escape");
    await expectClosed();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("modal: takes the rest of the page out of reach and locks scroll, and restores both", async () => {
    render(<Basic modal />);
    expect(outsideUnreachable()).toBe(false);
    await openByClick();
    await waitFor(() => expect(outsideUnreachable()).toBe(true));
    await waitFor(() => expect(scrollLocked()).toBe(true));

    key(document.activeElement as Element, "Escape");
    await expectClosed();
    await waitFor(() => expect(outsideUnreachable()).toBe(false));
    expect(scrollLocked()).toBe(false);
  });

  it("non-modal: leaves the page reachable and does not lock scroll", async () => {
    render(<Basic modal={false} />);
    await openByClick();
    expect(outsideUnreachable()).toBe(false);
    expect(scrollLocked()).toBe(false);
  });

  it("non-modal: an outside press closes it and focus returns to the trigger", async () => {
    render(<Basic modal={false} />);
    await openByClick();

    press(emptySpace());
    await expectClosed();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("non-modal: focus leaving the popover closes it", async () => {
    const onOpenChange = vi.fn();
    render(<Basic modal={false} onOpenChange={onOpenChange} />);
    await openByClick();

    leaveFocus();
    await expectClosed();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "focus-out" }),
    );
  });

  it("non-modal: focus moving between elements inside keeps it open", async () => {
    render(<Basic modal={false} />);
    await openByClick();

    act(() => screen.getByRole("button", { name: "Done" }).focus());
    act(() => screen.getByLabelText("Search").focus());
    expect(openPopup()).not.toBeNull();
  });
});

describe("Popover disabled trigger", () => {
  it("renders a native disabled button that cannot open or take focus", async () => {
    render(<Basic triggerProps={{ disabled: true }} />);

    expect(trigger()).toBeDisabled();
    act(() => trigger().focus());
    expect(trigger()).not.toHaveFocus();

    press(trigger());
    key(trigger(), "Enter");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(openPopup()).toBeNull();
  });
});

describe("Popover inside a form", () => {
  function InForm({
    onSubmit,
    withInput = true,
  }: {
    onSubmit: () => void;
    withInput?: boolean;
  }) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input aria-label="Title" />
        <button type="submit">Save form</button>
        <Popover>
          <PopoverTrigger>Open popover</PopoverTrigger>
          <PopoverPopup>
            <PopoverTitle>Task status</PopoverTitle>
            {withInput ? <input aria-label="Search" /> : null}
            <PopoverClose>Done</PopoverClose>
          </PopoverPopup>
        </Popover>
      </form>
    );
  }

  // Negative control: the key helper submits a plain input in a form, so a
  // test that expects no submit can fail.
  it("(control) implicit submission on Enter reaches a plain input", () => {
    const onSubmit = vi.fn();
    render(<InForm onSubmit={onSubmit} />);
    key(screen.getByLabelText("Title"), "Enter");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not submit the form when Enter or Space opens the trigger", async () => {
    const onSubmit = vi.fn();
    render(<InForm onSubmit={onSubmit} />);

    act(() => trigger().focus());
    key(trigger(), "Enter");
    await expectOpen();
    key(document.activeElement as Element, "Escape");
    await expectClosed();
    key(trigger(), " ");
    await expectOpen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit the form when Enter is pressed in an input inside the popover", async () => {
    const onSubmit = vi.fn();
    render(<InForm onSubmit={onSubmit} />);
    press(trigger());
    await expectOpen();

    key(screen.getByLabelText("Search"), "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit the form when a plain button inside the popover is pressed", async () => {
    const onSubmit = vi.fn();
    const onPick = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Popover>
          <PopoverTrigger>Open popover</PopoverTrigger>
          <PopoverPopup>
            <PopoverTitle>Task status</PopoverTitle>
            <button onClick={onPick}>Pick</button>
          </PopoverPopup>
        </Popover>
      </form>,
    );
    press(trigger());
    await expectOpen();

    press(screen.getByRole("button", { name: "Pick" }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit the form when an <input type=submit> inside the popover is pressed", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onPick = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Popover>
          <PopoverTrigger>Open popover</PopoverTrigger>
          <PopoverPopup>
            <PopoverTitle>Task status</PopoverTitle>
            <input onClick={onPick} type="submit" value="Pick" />
          </PopoverPopup>
        </Popover>
      </form>,
    );
    press(trigger());
    await expectOpen();

    press(screen.getByRole("button", { name: "Pick" }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("negative control: an <input type=submit> outside a popover does submit the form", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input type="submit" value="Plain submit" />
      </form>,
    );
    press(screen.getByRole("button", { name: "Plain submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("still submits a form that sits inside the popover", async () => {
    const outer = vi.fn((event: React.FormEvent) => event.preventDefault());
    const inner = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={outer}>
        <Popover>
          <PopoverTrigger>Open popover</PopoverTrigger>
          <PopoverPopup>
            <PopoverTitle>Task status</PopoverTitle>
            <form onSubmit={inner}>
              <input type="submit" value="Create" />
            </form>
          </PopoverPopup>
        </Popover>
      </form>,
    );
    press(trigger());
    await expectOpen();

    press(screen.getByRole("button", { name: "Create" }));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it("does not submit the form when a Close part is pressed", async () => {
    const onSubmit = vi.fn();
    render(<InForm onSubmit={onSubmit} withInput={false} />);
    press(trigger());
    await expectOpen();

    const done = screen.getByRole("button", { name: "Done" });
    expect(done).toHaveAttribute("type", "button");
    press(done);
    await expectClosed();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("Popover handle", () => {
  it("connects a trigger outside the popover through a handle and closes through the handle", async () => {
    const handle = PopoverCreateHandle<string>();
    render(
      <>
        <PopoverTrigger handle={handle} id="detached" payload="row-1">
          Open popover
        </PopoverTrigger>
        <Popover handle={handle}>
          <PopoverPopup>
            <PopoverTitle>Detached</PopoverTitle>
            <PopoverClose>Done</PopoverClose>
          </PopoverPopup>
        </Popover>
      </>,
    );

    press(trigger());
    await expectOpen();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    act(() => handle.close());
    await expectClosed();
  });

  it("opens through the handle by trigger id", async () => {
    const handle = PopoverCreateHandle<string>();
    render(
      <>
        <PopoverTrigger handle={handle} id="detached">
          Open popover
        </PopoverTrigger>
        <Popover handle={handle}>
          <PopoverPopup>
            <PopoverTitle>Detached</PopoverTitle>
          </PopoverPopup>
        </Popover>
      </>,
    );

    act(() => handle.open("detached"));
    await expectOpen();
    expect(handle.isOpen).toBe(true);
    act(() => handle.close());
    await expectClosed();
    expect(handle.isOpen).toBe(false);
  });
});

describe("Popover with other popups inside", () => {
  const FRUITS = [
    { value: "apple", label: "Apple" },
    { value: "pear", label: "Pear" },
  ];

  function WithSelect({ onValueChange }: { onValueChange?: () => void }) {
    return (
      <Basic>
        <Select
          items={FRUITS}
          onValueChange={onValueChange}
          defaultValue="apple"
        >
          <SelectTrigger aria-label="Fruit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FRUITS.map((fruit) => (
              <SelectItem key={fruit.value} value={fruit.value}>
                {fruit.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Basic>
    );
  }

  const visible = (selector: string) =>
    [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (el) => !el.closest("[data-closed], [hidden]"),
    );
  const listbox = () => visible('[role="listbox"]')[0] ?? null;
  const menus = () => visible('[role="menu"]');

  it("a select opens inside the popover and picks a value, and the popover stays open", async () => {
    const onValueChange = vi.fn();
    render(<WithSelect onValueChange={onValueChange} />);
    await openByClick();

    press(screen.getByRole("combobox", { name: "Fruit" }));
    await waitFor(() => expect(listbox()).not.toBeNull());
    press(screen.getByRole("option", { name: "Pear" }));
    await waitFor(() => expect(listbox()).toBeNull());
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("pear");
    expect(openPopup()).not.toBeNull();
  });

  // Record section 9, browser row "Popup in a layer".
  it("Escape closes only the select, then the popover on the next Escape", async () => {
    render(<WithSelect />);
    await openByClick();

    press(screen.getByRole("combobox", { name: "Fruit" }));
    await waitFor(() => expect(listbox()).not.toBeNull());

    key(document.activeElement as Element, "Escape");
    await waitFor(() => expect(listbox()).toBeNull());
    expect(openPopup()).not.toBeNull();

    await waitFor(() =>
      expect(openPopup()?.contains(document.activeElement)).toBe(true),
    );
    key(document.activeElement as Element, "Escape");
    await expectClosed();
  });

  function WithMenu({ onPick }: { onPick?: () => void }) {
    return (
      <Basic>
        <Menu>
          <MenuTrigger>Actions</MenuTrigger>
          <MenuPopup>
            <MenuItem onClick={onPick}>Rename</MenuItem>
            <MenuItem>Archive</MenuItem>
          </MenuPopup>
        </Menu>
      </Basic>
    );
  }

  it("a menu opens inside the popover, highlights and picks, and the popover stays open", async () => {
    const onPick = vi.fn();
    render(<WithMenu onPick={onPick} />);
    await openByClick();

    press(screen.getByRole("button", { name: "Actions" }));
    await waitFor(() => expect(menus()).toHaveLength(1));
    await waitFor(() =>
      expect(menus()[0]?.contains(document.activeElement)).toBe(true),
    );
    key(document.activeElement as Element, "ArrowDown");
    await waitFor(() =>
      expect(
        screen
          .getByRole("menuitem", { name: "Rename" })
          .hasAttribute("data-highlighted") ||
          screen.getByRole("menuitem", { name: "Rename" }) ===
            document.activeElement,
      ).toBe(true),
    );
    key(document.activeElement as Element, "Enter");
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(menus()).toHaveLength(0));
    expect(openPopup()).not.toBeNull();
  });

  it("Escape closes only the menu, then the popover on the next Escape", async () => {
    render(<WithMenu />);
    await openByClick();

    press(screen.getByRole("button", { name: "Actions" }));
    await waitFor(() => expect(menus()).toHaveLength(1));

    key(document.activeElement as Element, "Escape");
    await waitFor(() => expect(menus()).toHaveLength(0));
    expect(openPopup()).not.toBeNull();

    await waitFor(() =>
      expect(openPopup()?.contains(document.activeElement)).toBe(true),
    );
    key(document.activeElement as Element, "Escape");
    await expectClosed();
  });

  it("a command list inside it highlights and picks, and the popover stays open", async () => {
    const onSelect = vi.fn();
    render(
      <Basic>
        <Command>
          <CommandInput aria-label="Find" />
          <CommandList>
            <CommandItem onSelect={() => onSelect("a")} value="Alpha">
              Alpha
            </CommandItem>
            <CommandItem onSelect={() => onSelect("b")} value="Beta">
              Beta
            </CommandItem>
          </CommandList>
        </Command>
      </Basic>,
    );
    await openByClick();

    const input = screen.getByRole("combobox", { name: "Find" });
    act(() => input.focus());
    const highlighted = () =>
      screen
        .getAllByRole("option")
        .find((option) => option.hasAttribute("data-highlighted"))?.textContent;
    key(input, "ArrowDown");
    await waitFor(() => expect(highlighted()).toBeDefined());
    if (highlighted() !== "Beta") {
      key(input, "ArrowDown");
      await waitFor(() => expect(highlighted()).toBe("Beta"));
    }
    key(input, "Enter");
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(openPopup()).not.toBeNull();

    key(input, "Escape");
    await expectClosed();
  });
});

describe("Popover popup containment", () => {
  it("contains pointer and command events by default (record section 11)", async () => {
    await expectPopupContainment({
      render: ({ containEvents, contentProps, control }) => (
        <Popover>
          <PopoverTrigger>Open popover</PopoverTrigger>
          <PopoverPopup containEvents={containEvents} {...contentProps}>
            <PopoverTitle>Task status</PopoverTitle>
            {control}
          </PopoverPopup>
        </Popover>
      ),
      open: async () => {
        press(trigger());
        await expectOpen();
      },
      content: () => openPopup() as Element,
    });
  });
});
