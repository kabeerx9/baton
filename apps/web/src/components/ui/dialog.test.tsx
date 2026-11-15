/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The ancestor elements stand in for a clickable card or row around a dialog;
   they are probes, not interactive UI. */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogCreateHandle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPanel,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogViewport,
} from "./dialog";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./menu";
import { expectPopupContainment } from "./popup-containment-test-utils";
import { Popover, PopoverPopup, PopoverTrigger } from "./popover";
import { POPUP_RESET } from "./popup-reset";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

// Library names. Section 4 of the migration record lists the renames: the
// content slot `dialog-popup` becomes `dialog-content`. `dialog-backdrop` is
// unchanged.
const SLOT = { content: "dialog-content", backdrop: "dialog-backdrop" };
const PORTED = true;

afterEach(cleanup);

type OpenChange = (open: boolean, details: { reason: string }) => void;

/** The open dialog content. UI SDK keeps closed content in the page. */
function openDialogs() {
  return [
    ...document.querySelectorAll<HTMLElement>(`[data-slot="${SLOT.content}"]`),
  ].filter((el) => !el.hasAttribute("data-closed") && !el.hidden);
}

const openDialog = () => openDialogs().at(-1) ?? null;

async function expectOpen() {
  await waitFor(() => expect(openDialog()).not.toBeNull());
}

async function expectClosed() {
  await waitFor(() => expect(openDialogs()).toHaveLength(0));
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
 * cancelled. Returns whether a default action ran, so a test that expects one
 * can fail when the library cancels the key and the action never runs.
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
  rootProps,
  children,
}: {
  contentProps?: React.ComponentProps<typeof DialogContent>;
  onOpenChange?: OpenChange;
  triggerProps?: React.ComponentProps<typeof DialogTrigger>;
  rootProps?: Partial<React.ComponentProps<typeof Dialog>>;
  children?: React.ReactNode;
}) {
  return (
    <>
      <button type="button">Outside</button>
      <p>Empty space</p>
      <Dialog onOpenChange={onOpenChange} {...rootProps}>
        <DialogTrigger {...triggerProps}>Open dialog</DialogTrigger>
        <DialogContent {...contentProps}>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>Change the details</DialogDescription>
          </DialogHeader>
          {children ?? (
            <>
              <DialogPanel>
                <input aria-label="Search" />
              </DialogPanel>
              <DialogFooter>
                <DialogClose>Done</DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: "Open dialog" });
// By text: a modal dialog hides the rest of the page from the role queries.
const outside = () => screen.getByText("Outside");
const backdrop = () =>
  document.querySelector<HTMLElement>(`[data-slot="${SLOT.backdrop}"]`);

async function openByClick() {
  press(trigger());
  await expectOpen();
  // Both libraries move focus into the dialog after it opens.
  await waitFor(() =>
    expect(openDialog()?.contains(document.activeElement)).toBe(true),
  );
}

describe("Dialog roles, slots and trigger", () => {
  it("renders a button trigger that opens a named, described dialog", async () => {
    render(<Basic />);

    const button = trigger();
    expect(button).toHaveAttribute("data-slot", "dialog-trigger");
    expect(button).toHaveAttribute("type", "button");
    // Base UI sets aria-expanded; UI SDK uses aria-controls and data-open.
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    if (!PORTED) expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("data-open");
    expect(openDialog()).toBeNull();

    await openByClick();
    if (PORTED) expect(button).toHaveAttribute("data-open");
    else expect(button).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: "Edit task" });
    expect(dialog).toHaveAccessibleDescription("Change the details");
    expect(dialog).toBe(openDialog());
    expect(dialog).toHaveAttribute("data-slot", SLOT.content);
  });

  it("renders a backdrop and the part slots", async () => {
    render(<Basic />);
    await openByClick();

    expect(backdrop()).not.toBeNull();
    expect(screen.getByText("Edit task")).toHaveAttribute(
      "data-slot",
      "dialog-title",
    );
    expect(screen.getByText("Change the details")).toHaveAttribute(
      "data-slot",
      "dialog-description",
    );
    expect(
      document.querySelector('[data-slot="dialog-header"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-slot="dialog-panel"]')).not.toBeNull();
    expect(
      document.querySelector('[data-slot="dialog-footer"]'),
    ).not.toBeNull();
  });

  it("starts the content from the app's text styles", async () => {
    render(<Basic />);
    await openByClick();
    for (const token of POPUP_RESET.split(" ")) {
      if (PORTED) expect(openDialog()).toHaveClass(token);
    }
  });

  it("applies className to the content and the instant flag to its transitions", async () => {
    render(<Basic contentProps={{ className: "max-w-md", instant: true }} />);
    await openByClick();
    expect(openDialog()).toHaveClass("max-w-md", "transition-none");
  });

  it("lets a caller override the width", async () => {
    render(<Basic contentProps={{ className: "w-auto" }} />);
    await openByClick();
    expect(openDialog()).toHaveClass("w-auto");
    expect(openDialog()).not.toHaveClass("w-full");
  });

  it("shows a close button by default and hides it with showCloseButton={false}", async () => {
    const { unmount } = render(<Basic />);
    await openByClick();
    // The default close button is the icon button in the corner: it has an
    // accessible name and is not the "Done" part.
    const closers = within(openDialog() as HTMLElement).filter(
      (button) => button.textContent !== "Done",
    );
    expect(closers).toHaveLength(1);
    expect(closers[0]).toHaveAccessibleName();
    press(closers[0] as Element);
    await expectClosed();
    unmount();

    render(<Basic contentProps={{ showCloseButton: false }} />);
    await openByClick();
    expect(
      within(openDialog() as HTMLElement).filter(
        (button) => button.textContent !== "Done",
      ),
    ).toHaveLength(0);
  });

  it("renders the trigger, title and close as the child element with asChild", async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <a href="/somewhere">Open link</a>
        </DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle asChild>
            <h3>As heading</h3>
          </DialogTitle>
          <DialogClose asChild>
            <a href="/elsewhere">Leave</a>
          </DialogClose>
        </DialogContent>
      </Dialog>,
    );
    const link = screen.getByRole("link", { name: "Open link" });
    expect(link).toHaveAttribute("data-slot", "dialog-trigger");
    press(link);
    await expectOpen();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "As heading",
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveAttribute(
      "data-slot",
      "dialog-title",
    );
    expect(screen.getByRole("link", { name: "Leave" })).toHaveAttribute(
      "data-slot",
      "dialog-close",
    );
  });
});

/** The buttons inside an element, by DOM order. */
function within(element: HTMLElement) {
  return [...element.querySelectorAll<HTMLButtonElement>("button")];
}

describe("Dialog open and close", () => {
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

  it("moves focus into the content on open and keeps it open on an inside press", async () => {
    render(<Basic />);
    await openByClick();
    press(screen.getByLabelText("Search"));
    press(screen.getByRole("dialog"));
    expect(openDialog()).not.toBeNull();
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

  it("closes on a backdrop press and returns focus to the trigger", async () => {
    const onOpenChange = vi.fn();
    render(<Basic onOpenChange={onOpenChange} />);
    await openByClick();

    press(backdrop() as Element);
    await expectClosed();
    await waitFor(() => expect(trigger()).toHaveFocus());
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "outside-press" }),
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
  });

  it("works controlled, and a refusing handler keeps it open", async () => {
    function Controlled({ allowClose }: { allowClose: boolean }) {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <span data-testid="state">{String(open)}</span>
          <Basic
            rootProps={{
              open,
              onOpenChange: (next) => {
                if (next || allowClose) setOpen(next);
              },
            }}
          />
        </>
      );
    }
    const first = render(<Controlled allowClose />);
    press(trigger());
    await expectOpen();
    expect(screen.getByTestId("state")).toHaveTextContent("true");
    key(document.activeElement as Element, "Escape");
    await expectClosed();
    expect(screen.getByTestId("state")).toHaveTextContent("false");
    first.unmount();

    render(<Controlled allowClose={false} />);
    press(trigger());
    await expectOpen();
    key(document.activeElement as Element, "Escape");
    await act(async () => {});
    expect(screen.getByTestId("state")).toHaveTextContent("true");
    expect(openDialog()).not.toBeNull();
  });

  it("calls onOpenChangeComplete with the final state", async () => {
    const onOpenChangeComplete = vi.fn();
    render(<Basic rootProps={{ onOpenChangeComplete }} />);
    await openByClick();
    await waitFor(() =>
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(true),
    );
    key(document.activeElement as Element, "Escape");
    await expectClosed();
    await waitFor(() =>
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false),
    );
  });

  it("opens on mount with defaultOpen", async () => {
    render(<Basic rootProps={{ defaultOpen: true }} />);
    await expectOpen();
  });

  it("does not close from an outside press when dismissal by press is off", async () => {
    // Base UI: disablePointerDismissal. UI SDK: closeOnOutsidePress={false}.
    // The wrapper keeps the Base UI prop name for callers.
    render(<Basic rootProps={{ disablePointerDismissal: true }} />);
    await openByClick();
    press(backdrop() as Element);
    await act(async () => {});
    expect(openDialog()).not.toBeNull();
    key(document.activeElement as Element, "Escape");
    await expectClosed();
  });
});

describe("Dialog modal behaviour", () => {
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

  it("takes the rest of the page out of reach and locks scroll, and restores both", async () => {
    render(<Basic />);
    expect(outsideUnreachable()).toBe(false);
    await openByClick();
    await waitFor(() => expect(outsideUnreachable()).toBe(true));
    await waitFor(() => expect(scrollLocked()).toBe(true));

    key(document.activeElement as Element, "Escape");
    await expectClosed();
    await waitFor(() => expect(outsideUnreachable()).toBe(false));
    expect(scrollLocked()).toBe(false);
  });

  it("modal={false} leaves the page reachable and does not lock scroll", async () => {
    render(<Basic rootProps={{ modal: false }} />);
    await openByClick();
    expect(outsideUnreachable()).toBe(false);
    expect(scrollLocked()).toBe(false);
  });
});

describe("Dialog nesting", () => {
  function Nested({
    onOuterChange,
    onInnerChange,
  }: {
    onOuterChange?: OpenChange;
    onInnerChange?: OpenChange;
  }) {
    return (
      <Dialog onOpenChange={onOuterChange}>
        <DialogTrigger>Open outer</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Outer</DialogTitle>
          <Dialog onOpenChange={onInnerChange}>
            <DialogTrigger>Open inner</DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogTitle>Inner</DialogTitle>
              <DialogClose>Close inner</DialogClose>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    );
  }

  it("Escape closes the inner dialog first, then the outer one", async () => {
    render(<Nested />);
    press(screen.getByRole("button", { name: "Open outer" }));
    await expectOpen();
    press(screen.getByRole("button", { name: "Open inner" }));
    await waitFor(() => expect(openDialogs()).toHaveLength(2));

    key(document.activeElement as Element, "Escape");
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    expect(openDialog()).toHaveAccessibleName("Outer");

    key(document.activeElement as Element, "Escape");
    await expectClosed();
  });

  it("a backdrop press closes only the inner dialog", async () => {
    render(<Nested />);
    press(screen.getByRole("button", { name: "Open outer" }));
    await expectOpen();
    press(screen.getByRole("button", { name: "Open inner" }));
    await waitFor(() => expect(openDialogs()).toHaveLength(2));

    const backdrops = document.querySelectorAll(
      `[data-slot="${SLOT.backdrop}"]`,
    );
    press(backdrops[backdrops.length - 1] as Element);
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    expect(openDialog()).toHaveAccessibleName("Outer");
  });
});

describe("Dialog handle", () => {
  it("opens and closes from a handle shared by a detached trigger", async () => {
    const handle = DialogCreateHandle<{ name: string }>();
    expect(handle.isOpen).toBe(false);
    render(
      <>
        <DialogTrigger handle={handle} id="detached">
          Detached open
        </DialogTrigger>
        <Dialog handle={handle}>
          <DialogContent showCloseButton={false}>
            <DialogTitle>Detached</DialogTitle>
          </DialogContent>
        </Dialog>
      </>,
    );
    press(screen.getByRole("button", { name: "Detached open" }));
    await expectOpen();
    expect(handle.isOpen).toBe(true);

    act(() => handle.close());
    await expectClosed();
    expect(handle.isOpen).toBe(false);

    act(() => handle.open("detached"));
    await expectOpen();
    act(() => handle.close());
    await expectClosed();
  });
});

describe("Dialog exports kept for callers", () => {
  it("keeps DialogPortal, DialogViewport and DialogOverlay as usable parts", async () => {
    expect(DialogOverlay).toBe(DialogBackdrop);
    render(
      <Dialog defaultOpen>
        <DialogPortal>
          <DialogOverlay />
          <DialogViewport>
            <DialogContent showCloseButton={false}>
              <DialogTitle>Parts</DialogTitle>
            </DialogContent>
          </DialogViewport>
        </DialogPortal>
      </Dialog>,
    );
    await expectOpen();
    expect(screen.getByRole("dialog", { name: "Parts" })).toBeInTheDocument();
  });
});

describe("Dialog props", () => {
  it("honors initialFocus given as a ref and finalFocus={false}", async () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <Basic
        contentProps={{
          initialFocus: ref,
          finalFocus: false,
          children: undefined,
        }}
      >
        <input aria-label="First" />
        <input aria-label="Second" ref={ref} />
        <DialogClose>Done</DialogClose>
      </Basic>,
    );
    press(trigger());
    await expectOpen();
    await waitFor(() => expect(screen.getByLabelText("Second")).toHaveFocus());

    act(() => (outside() as HTMLElement).focus());
    press(screen.getByRole("button", { name: "Done" }));
    await expectClosed();
    await act(async () => {});
    // finalFocus={false}: focus is not sent back to the trigger.
    expect(trigger()).not.toHaveFocus();
  });
});

// UI SDK renders content in place, and in strict mode it throws when that is
// inside a form. A dialog opened from inside a form passes `container` on its
// content (record rule 8), so these cases do the same.
describe("Dialog and forms", () => {
  it("Enter on the trigger opens the dialog and does not submit the form around it", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Name" />
        <Dialog>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent container={document.body} showCloseButton={false}>
            <DialogTitle>In form</DialogTitle>
          </DialogContent>
        </Dialog>
        <button type="submit">Save</button>
      </form>,
    );
    act(() => trigger().focus());
    key(trigger(), "Enter");
    await expectOpen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("negative control: a plain button in the same form does submit on Enter", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <button>Plain</button>
      </form>,
    );
    key(screen.getByRole("button", { name: "Plain" }), "Enter");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Enter in an input submits only the dialog's own form, once", async () => {
    const inner = vi.fn((event: React.FormEvent) => event.preventDefault());
    const outer = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={outer}>
        <Dialog>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent container={document.body} showCloseButton={false}>
            <DialogTitle>Inner form</DialogTitle>
            <form onSubmit={inner}>
              <input aria-label="Title" />
              <button type="submit">Create</button>
            </form>
          </DialogContent>
        </Dialog>
      </form>,
    );
    press(trigger());
    await expectOpen();
    const ran = key(screen.getByLabelText("Title"), "Enter");
    expect(ran, "Enter in the input must reach implicit submission").toBe(true);
    expect(inner).toHaveBeenCalledTimes(1);
    // Base UI portals the dialog, but React still sends the inner submit up the
    // component tree to the outer form (record section 11). Containment stops it.
    if (PORTED) expect(outer).not.toHaveBeenCalled();
    expect(openDialog()).not.toBeNull();
  });

  it("Enter in an input with no form of its own does not submit the form around the dialog", async () => {
    const outer = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={outer}>
        <Dialog>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent container={document.body} showCloseButton={false}>
            <DialogTitle>Loose input</DialogTitle>
            <input aria-label="Search" />
          </DialogContent>
        </Dialog>
        <button type="submit">Save</button>
      </form>,
    );
    press(trigger());
    await expectOpen();
    key(screen.getByLabelText("Search"), "Enter");
    expect(outer).not.toHaveBeenCalled();
  });

  it("a Close part inside the dialog's form closes without submitting", async () => {
    const inner = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Form close</DialogTitle>
          <form onSubmit={inner}>
            <DialogClose>Cancel</DialogClose>
            <button type="submit">Create</button>
          </form>
        </DialogContent>
      </Dialog>,
    );
    press(trigger());
    await expectOpen();
    key(screen.getByRole("button", { name: "Cancel" }), "Enter");
    await expectClosed();
    expect(inner).not.toHaveBeenCalled();
  });

  it("a Close part given a Button element via render still does not submit", async () => {
    const inner = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Render close</DialogTitle>
          <form onSubmit={inner}>
            <DialogClose render={<button type="button" />}>Back</DialogClose>
          </form>
        </DialogContent>
      </Dialog>,
    );
    press(trigger());
    await expectOpen();
    key(screen.getByRole("button", { name: "Back" }), "Enter");
    await expectClosed();
    expect(inner).not.toHaveBeenCalled();
  });
});

describe("Dialog disabled", () => {
  it("a disabled trigger is natively disabled, not focusable and does not open", async () => {
    const onOpenChange = vi.fn();
    render(
      <Basic triggerProps={{ disabled: true }} onOpenChange={onOpenChange} />,
    );
    const button = trigger();
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    act(() => button.focus());
    expect(button).not.toHaveFocus();
    key(button, "Enter");
    press(button);
    await act(async () => {});
    expect(openDialog()).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("a disabled Close part is natively disabled and does not close", async () => {
    render(
      <Basic>
        <DialogClose disabled>Locked</DialogClose>
      </Basic>,
    );
    await openByClick();
    const locked = screen.getByRole("button", { name: "Locked" });
    expect(locked).toBeDisabled();
    press(locked);
    await act(async () => {});
    expect(openDialog()).not.toBeNull();
  });
});

describe.skipIf(!PORTED)("Dialog event containment", () => {
  it("contains pointer and command events in the content and the backdrop", async () => {
    await expectPopupContainment({
      render: ({ containEvents, contentProps, control }) => (
        <Dialog>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent
            {...contentProps}
            containEvents={containEvents}
            showCloseButton={false}
          >
            <DialogTitle>Contained</DialogTitle>
            {control}
          </DialogContent>
        </Dialog>
      ),
      open: async () => {
        press(trigger());
        await expectOpen();
      },
      content: () => openDialog() as Element,
      backdrop: () => backdrop(),
    });
  });

  it("a click on the backdrop does not reach a clickable row around the dialog", async () => {
    const onClick = vi.fn();
    render(
      <div onClick={onClick}>
        <Basic />
      </div>,
    );
    await openByClick();
    onClick.mockClear();
    press(backdrop() as Element);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe.skipIf(!PORTED)("Popups inside an open dialog", () => {
  function WithPopups() {
    return (
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Popups</DialogTitle>
          <Select defaultValue="a">
            <SelectTrigger aria-label="Choice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Alpha</SelectItem>
              <SelectItem value="b">Beta</SelectItem>
            </SelectContent>
          </Select>
          <Menu>
            <MenuTrigger>Actions</MenuTrigger>
            <MenuPopup>
              <MenuItem>Rename</MenuItem>
            </MenuPopup>
          </Menu>
          <Popover>
            <PopoverTrigger>Details</PopoverTrigger>
            <PopoverPopup>
              <p>Popover body</p>
            </PopoverPopup>
          </Popover>
        </DialogContent>
      </Dialog>
    );
  }

  const innerOpen = (slot: string) =>
    [...document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)].find(
      (el) => !el.hasAttribute("data-closed") && !el.hidden,
    ) ?? null;

  it.each([
    ["menu", "Actions", "menu-content"],
    ["popover", "Details", "popover-content"],
    ["select", "Choice", "select-content"],
  ])(
    "a %s opens inside the dialog and Escape closes only it",
    async (_name, label, slot) => {
      render(<WithPopups />);
      await openByClick();

      const opener =
        label === "Choice"
          ? screen.getByRole("combobox", { name: "Choice" })
          : screen.getByRole("button", { name: label });
      press(opener);
      await waitFor(() => expect(innerOpen(slot)).not.toBeNull());
      expect(openDialog()?.contains(innerOpen(slot))).toBe(true);

      key(document.activeElement as Element, "Escape");
      await waitFor(() => expect(innerOpen(slot)).toBeNull());
      expect(openDialog()).not.toBeNull();

      key(document.activeElement as Element, "Escape");
      await expectClosed();
    },
  );
});
