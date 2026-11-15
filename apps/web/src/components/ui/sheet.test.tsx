/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The ancestor elements stand in for a clickable card or row around a sheet;
   they are probes, not interactive UI. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

import { expectPopupContainment } from "./popup-containment-test-utils";
import { POPUP_RESET } from "./popup-reset";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

// UI SDK names (record section 4): content slot `dialog-content` and backdrop
// `dialog-backdrop`, as for other dialogs. The sheet keeps a `data-sheet`
// identity on the content because the part owns the slot name.
const SLOT = {
  content: "dialog-content",
  backdrop: "dialog-backdrop",
};

type Side = "right" | "left" | "top" | "bottom";

afterEach(cleanup);

type OpenChange = (open: boolean, details: { reason: string }) => void;

function panels() {
  return [
    ...document.querySelectorAll<HTMLElement>(`[data-slot="${SLOT.content}"]`),
  ];
}

/** The open content. UI SDK keeps closed content in the page and marks it closed. */
function openPanel() {
  return (
    panels().find(
      (el) => !el.hasAttribute("data-closed") && !el.hasAttribute("hidden"),
    ) ?? null
  );
}

async function expectOpen() {
  await waitFor(() => expect(openPanel()).not.toBeNull());
}

async function expectClosed() {
  await waitFor(() => expect(openPanel()).toBeNull());
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
 * A key press the way a browser runs it. jsdom does not run a native button's
 * default action, so this does: a button gets its click and a text input gets
 * implicit form submission, both only when the keydown was not cancelled.
 * Returns whether a default action ran, so a test that expects one can fail
 * when the library cancels the key and the action never runs.
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
  children,
  contentProps,
  onOpenChange,
  rootProps,
  side = "right",
  triggerProps,
}: {
  children?: React.ReactNode;
  contentProps?: React.ComponentProps<typeof SheetPopup>;
  onOpenChange?: OpenChange;
  rootProps?: Partial<React.ComponentProps<typeof Sheet>>;
  side?: Side;
  triggerProps?: React.ComponentProps<typeof SheetTrigger>;
}) {
  return (
    <>
      <button type="button">Outside</button>
      <p>Empty space</p>
      <Sheet onOpenChange={onOpenChange} {...rootProps}>
        <SheetTrigger {...triggerProps}>Open panel</SheetTrigger>
        <SheetPopup side={side} {...contentProps}>
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow the list</SheetDescription>
          </SheetHeader>
          {children ?? (
            <>
              <SheetPanel>
                <input aria-label="Search" />
              </SheetPanel>
              <SheetFooter>
                <SheetClose>Done</SheetClose>
              </SheetFooter>
            </>
          )}
        </SheetPopup>
      </Sheet>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: "Open panel" });
// By text: a modal dialog hides the rest of the page from the role queries.
const outside = () => screen.getByText("Outside");
const backdrop = () =>
  document.querySelector<HTMLElement>(`[data-slot="${SLOT.backdrop}"]`);

async function openByClick(side: Side = "right") {
  press(trigger());
  await expectOpen();
  await waitFor(() =>
    expect(openPanel()?.contains(document.activeElement)).toBe(true),
  );
  return side;
}

/** The buttons inside an element, by DOM order. */
function within(element: HTMLElement) {
  return [...element.querySelectorAll<HTMLButtonElement>("button")];
}

const scrollLocked = () =>
  [document.documentElement, document.body].some(
    (el) => el.style.overflow === "hidden" || el.style.overflowY === "hidden",
  );

describe("Sheet roles, slots and trigger", () => {
  it("renders a button trigger that opens a named, described dialog", async () => {
    render(<Basic />);

    const button = trigger();
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).not.toHaveAttribute("data-open");
    expect(openPanel()).toBeNull();

    await openByClick();
    expect(button).toHaveAttribute("data-open");
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(dialog).toHaveAccessibleDescription("Narrow the list");
    expect(dialog).toBe(openPanel());
    expect(dialog).toHaveAttribute("data-slot", SLOT.content);
  });

  it("renders a backdrop and the part slots", async () => {
    render(<Basic />);
    await openByClick();

    expect(backdrop()).not.toBeNull();
    expect(screen.getByText("Filters")).toHaveAttribute(
      "data-slot",
      "dialog-title",
    );
    expect(screen.getByText("Narrow the list")).toHaveAttribute(
      "data-slot",
      "dialog-description",
    );
    expect(document.querySelector('[data-slot="sheet-header"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="sheet-panel"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="sheet-footer"]')).not.toBeNull();
  });

  it("starts the content from the app's text styles", async () => {
    render(<Basic />);
    await openByClick();
    for (const token of POPUP_RESET.split(" ")) {
      expect(openPanel()).toHaveClass(token);
    }
  });

  it("keeps a sheet identity now that the content slot is dialog-content", async () => {
    render(<Basic />);
    await openByClick();
    expect(openPanel()).toHaveAttribute("data-sheet");
  });

  it("shows a close button by default and hides it with showCloseButton={false}", async () => {
    const first = render(<Basic />);
    await openByClick();
    const closers = within(openPanel() as HTMLElement).filter(
      (button) => button.textContent !== "Done",
    );
    expect(closers).toHaveLength(1);
    expect(closers[0]).toHaveAccessibleName();
    press(closers[0] as Element);
    await expectClosed();
    first.unmount();

    render(<Basic contentProps={{ showCloseButton: false }} />);
    await openByClick();
    expect(
      within(openPanel() as HTMLElement).filter(
        (button) => button.textContent !== "Done",
      ),
    ).toHaveLength(0);
  });
});

describe("Sheet opens from each side", () => {
  it.each<Side>(["right", "left", "top", "bottom"])(
    "opens and closes a %s panel",
    async (side) => {
      render(<Basic side={side} />);
      await openByClick(side);
      expect(screen.getByRole("dialog", { name: "Filters" })).toBe(openPanel());
      // The side is a prop on the content, and the slide direction follows it.
      expect(openPanel()).toHaveAttribute("data-side", side);
      expect(openPanel()?.className).toMatch(
        side === "right" || side === "left"
          ? /data-starting-style:(?:-)?translate-x-8/
          : /data-starting-style:(?:-)?translate-y-8/,
      );

      press(screen.getByRole("button", { name: "Done" }));
      await expectClosed();
    },
  );
});

describe("Sheet open and close", () => {
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
    expect(openPanel()).not.toBeNull();
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

  it("does not close from a backdrop press when dismissal by press is off", async () => {
    // Base UI: disablePointerDismissal. UI SDK: closeOnOutsidePress={false}.
    // The wrapper keeps the Base UI prop name for callers.
    render(<Basic rootProps={{ disablePointerDismissal: true }} />);
    await openByClick();
    press(backdrop() as Element);
    await act(async () => {});
    expect(openPanel()).not.toBeNull();
    key(document.activeElement as Element, "Escape");
    await expectClosed();
  });
});

describe("Sheet modal behaviour", () => {
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

  it("keeps Tab inside the panel", async () => {
    render(<Basic />);
    await openByClick();
    const panel = openPanel() as HTMLElement;
    const focusable = [
      ...panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    expect(focusable.length).toBeGreaterThan(1);

    // UI SDK handles Tab itself and wraps focus. The browser check proves the
    // real Tab order; this proves the library's own handling.
    focusable.at(-1)?.focus();
    const notCancelled = fireEvent.keyDown(document.activeElement as Element, {
      key: "Tab",
    });
    expect(notCancelled, "UI SDK cancels Tab at the last stop").toBe(false);
    expect(document.activeElement, "Tab wraps to the first stop").toBe(
      focusable[0],
    );
    expect(panel.contains(document.activeElement)).toBe(true);
  });
});

describe("Sheet focus options", () => {
  it("honors initialFocus given as a ref and finalFocus={false}", async () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <Basic
        contentProps={{
          initialFocus: ref,
          finalFocus: false,
        }}
      >
        <input aria-label="First" />
        <input aria-label="Second" ref={ref} />
        <SheetClose>Done</SheetClose>
      </Basic>,
    );
    press(trigger());
    await expectOpen();
    await waitFor(() => expect(screen.getByLabelText("Second")).toHaveFocus());

    act(() => (outside() as HTMLElement).focus());
    press(screen.getByRole("button", { name: "Done" }));
    await expectClosed();
    await act(async () => {});
    expect(trigger()).not.toHaveFocus();
  });
});

// UI SDK renders content in place, and in strict mode it throws when that is
// inside a form. A sheet opened from inside a form passes `container` on its
// content (record rule 8), so these cases do the same.
describe("Sheet and forms", () => {
  it("Enter on the trigger opens the panel and does not submit the form around it", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Name" />
        <Sheet>
          <SheetTrigger>Open panel</SheetTrigger>
          <SheetPopup container={document.body}>
            <SheetHeader>
              <SheetTitle>In form</SheetTitle>
            </SheetHeader>
          </SheetPopup>
        </Sheet>
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

  it("Enter in an input submits only the panel's own form, once", async () => {
    const inner = vi.fn((event: React.FormEvent) => event.preventDefault());
    const outer = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={outer}>
        <Sheet>
          <SheetTrigger>Open panel</SheetTrigger>
          <SheetPopup container={document.body} showCloseButton={false}>
            <SheetTitle>Inner form</SheetTitle>
            <form onSubmit={inner}>
              <input aria-label="Title" />
              <button type="submit">Create</button>
            </form>
          </SheetPopup>
        </Sheet>
      </form>,
    );
    press(trigger());
    await expectOpen();
    const ran = key(screen.getByLabelText("Title"), "Enter");
    expect(ran, "Enter in the input must reach implicit submission").toBe(true);
    expect(inner).toHaveBeenCalledTimes(1);
    // React sends the inner submit up the component tree to the outer form
    // (record section 11). Containment stops it.
    expect(outer).not.toHaveBeenCalled();
    expect(openPanel()).not.toBeNull();
  });

  it("Enter in an input with no form of its own does not submit the form around the panel", async () => {
    const outer = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={outer}>
        <Sheet>
          <SheetTrigger>Open panel</SheetTrigger>
          <SheetPopup container={document.body}>
            <SheetTitle>Loose input</SheetTitle>
            <input aria-label="Search" />
          </SheetPopup>
        </Sheet>
        <button type="submit">Save</button>
      </form>,
    );
    press(trigger());
    await expectOpen();
    key(screen.getByLabelText("Search"), "Enter");
    expect(outer).not.toHaveBeenCalled();
  });

  it("a Close part inside the panel's form closes without submitting", async () => {
    const inner = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <Sheet>
        <SheetTrigger>Open panel</SheetTrigger>
        <SheetPopup showCloseButton={false}>
          <SheetTitle>Form close</SheetTitle>
          <form onSubmit={inner}>
            <SheetClose>Cancel</SheetClose>
            <button type="submit">Create</button>
          </form>
        </SheetPopup>
      </Sheet>,
    );
    press(trigger());
    await expectOpen();
    key(screen.getByRole("button", { name: "Cancel" }), "Enter");
    await expectClosed();
    expect(inner).not.toHaveBeenCalled();
  });
});

describe("Sheet disabled", () => {
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
    expect(openPanel()).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("a disabled Close part is natively disabled and does not close", async () => {
    render(
      <Basic>
        <SheetClose disabled>Locked</SheetClose>
      </Basic>,
    );
    await openByClick();
    const locked = screen.getByRole("button", { name: "Locked" });
    expect(locked).toBeDisabled();
    press(locked);
    await act(async () => {});
    expect(openPanel()).not.toBeNull();
  });
});

describe("Sheet reduced motion", () => {
  // The global stylesheet keeps the fade and drops movement for this slot.
  // A negative control below proves the lookup can fail.
  const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
  const reducedMotionBlock = css.slice(
    css.indexOf("@media (prefers-reduced-motion: reduce)"),
  );

  it("answers to the reduced-motion rule for its content slot", async () => {
    render(<Basic />);
    await openByClick();
    expect(openPanel()).toHaveAttribute("data-slot", SLOT.content);
    expect(reducedMotionBlock).toContain(`[data-slot="${SLOT.content}"]`);
    expect(reducedMotionBlock).toContain("[data-sheet]");
  });

  it("negative control: the same lookup does not find an unknown slot", () => {
    expect(reducedMotionBlock).not.toContain('[data-slot="sheet-fake"]');
  });
});

describe("Sheet event containment", () => {
  it("contains pointer and command events in the content and the backdrop", async () => {
    await expectPopupContainment({
      render: ({ containEvents, contentProps, control }) => (
        <Sheet>
          <SheetTrigger>Open panel</SheetTrigger>
          <SheetPopup
            {...contentProps}
            containEvents={containEvents}
            showCloseButton={false}
          >
            <SheetTitle>Contained</SheetTitle>
            {control}
          </SheetPopup>
        </Sheet>
      ),
      open: async () => {
        press(trigger());
        await expectOpen();
      },
      content: () => openPanel() as Element,
      backdrop: () => backdrop(),
    });
  });

  it("a click on the backdrop does not reach a clickable row around the sheet", async () => {
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

  it("warns when the content sits inside an anchor, and container fixes it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const first = render(
      <a href="#board">
        <Sheet>
          <SheetTrigger render={<button type="button" />}>
            Open panel
          </SheetTrigger>
          <SheetPopup showCloseButton={false}>
            <SheetTitle>Nested</SheetTitle>
          </SheetPopup>
        </Sheet>
      </a>,
    );
    press(trigger());
    await expectOpen();
    fireEvent.click(openPanel() as Element);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[popup-containment]"),
    );
    first.unmount();
    error.mockClear();

    render(
      <a href="#board">
        <Sheet>
          <SheetTrigger render={<button type="button" />}>
            Open panel
          </SheetTrigger>
          <SheetPopup container={document.body} showCloseButton={false}>
            <SheetTitle>Nested</SheetTitle>
          </SheetPopup>
        </Sheet>
      </a>,
    );
    press(trigger());
    await expectOpen();
    fireEvent.click(openPanel() as Element);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
