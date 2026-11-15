/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The ancestor elements stand in for a clickable row around an alert dialog; they
   are probes, not interactive UI. */
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
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogCreateHandle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogViewport,
} from "./alert-dialog";
import { expectPopupContainment } from "./popup-containment-test-utils";
import { POPUP_RESET } from "./popup-reset";

// UI SDK slot names (record section 4).
const SLOT = {
  content: "alert-dialog-content",
  backdrop: "alert-dialog-backdrop",
};

afterEach(cleanup);

type OpenChange = (open: boolean, details: { reason: string }) => void;

/** The open alert dialog content. UI SDK keeps it while it animates out. */
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
 * of Enter or Space, so this does: a native button gets its click, and both
 * only when the keydown was not cancelled. Returns whether a default action
 * ran, so a test that expects one can fail when the library cancels the key.
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
  return false;
}

function Basic({
  contentProps,
  onOpenChange,
  triggerProps,
  rootProps,
  footer,
}: {
  contentProps?: React.ComponentProps<typeof AlertDialogContent>;
  onOpenChange?: OpenChange;
  triggerProps?: React.ComponentProps<typeof AlertDialogTrigger>;
  rootProps?: Partial<React.ComponentProps<typeof AlertDialog>>;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <button type="button">Outside</button>
      <p>Empty space</p>
      <AlertDialog onOpenChange={onOpenChange} {...rootProps}>
        <AlertDialogTrigger {...triggerProps}>Open alert</AlertDialogTrigger>
        <AlertDialogContent {...contentProps}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {footer ?? (
              <>
                <AlertDialogClose>Cancel</AlertDialogClose>
                <AlertDialogClose value="confirm">Delete</AlertDialogClose>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: "Open alert" });
// By text: a modal dialog hides the rest of the page from the role queries.
const outside = () => screen.getByText("Outside");
const backdrop = () =>
  document.querySelector<HTMLElement>(`[data-slot="${SLOT.backdrop}"]`);

async function openByClick() {
  press(trigger());
  await expectOpen();
  await waitFor(() =>
    expect(openDialog()?.contains(document.activeElement)).toBe(true),
  );
}

describe("AlertDialog roles, slots and trigger", () => {
  it("renders a button trigger that opens a named, described alert dialog", async () => {
    render(<Basic />);

    const button = trigger();
    expect(button).toHaveAttribute("data-slot", "alert-dialog-trigger");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).not.toHaveAttribute("data-open");
    expect(openDialog()).toBeNull();

    await openByClick();
    const dialog = screen.getByRole("alertdialog", { name: "Delete task" });
    expect(dialog).toHaveAccessibleDescription("This cannot be undone");
    expect(dialog).toBe(openDialog());
    expect(dialog).toHaveAttribute("data-slot", SLOT.content);
    expect(button).toHaveAttribute("data-open");
  });

  it("renders a backdrop and the part slots", async () => {
    render(<Basic />);
    await openByClick();

    expect(backdrop()).not.toBeNull();
    expect(screen.getByText("Delete task")).toHaveAttribute(
      "data-slot",
      "alert-dialog-title",
    );
    expect(screen.getByText("This cannot be undone")).toHaveAttribute(
      "data-slot",
      "alert-dialog-description",
    );
    expect(
      document.querySelector('[data-slot="alert-dialog-header"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-slot="alert-dialog-footer"]'),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
      "data-slot",
      "alert-dialog-close",
    );
  });

  it("starts the content from the app's text styles", async () => {
    render(<Basic />);
    await openByClick();
    for (const token of POPUP_RESET.split(" ")) {
      expect(openDialog()).toHaveClass(token);
    }
  });

  it("applies className to the content", async () => {
    render(<Basic contentProps={{ className: "max-w-md" }} />);
    await openByClick();
    expect(openDialog()).toHaveClass("max-w-md");
  });

  it("puts initial focus on the first Close part, the cancel answer", async () => {
    render(<Basic />);
    await openByClick();
    // Alert dialogs start on the least destructive answer, so Enter cannot
    // agree by accident.
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });
});

describe("AlertDialog open and close", () => {
  it("opens on Enter and on Space, and Escape closes and returns focus to the trigger", async () => {
    render(<Basic />);

    act(() => trigger().focus());
    expect(key(trigger(), "Enter"), "Enter must reach the button").toBe(true);
    await expectOpen();
    key(document.activeElement as Element, "Escape");
    await expectClosed();
    await waitFor(() => expect(trigger()).toHaveFocus());

    expect(key(trigger(), " "), "Space must reach the button").toBe(true);
    await expectOpen();
    key(document.activeElement as Element, "Escape");
    await expectClosed();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("does not close on an outside press", async () => {
    const onOpenChange = vi.fn();
    render(<Basic onOpenChange={onOpenChange} />);
    await openByClick();
    onOpenChange.mockClear();

    press(outside());
    press(backdrop() as Element);
    press(document.body);
    await act(async () => {});

    expect(openDialog()).not.toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes from a Close part, runs the caller's handler once, and returns focus", async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <Basic
        onOpenChange={onOpenChange}
        footer={
          <>
            <AlertDialogClose>Cancel</AlertDialogClose>
            <AlertDialogClose value="confirm" onClick={onConfirm}>
              Delete
            </AlertDialogClose>
          </>
        }
      />,
    );
    await openByClick();
    onOpenChange.mockClear();

    press(screen.getByRole("button", { name: "Delete" }));
    await expectClosed();
    await waitFor(() => expect(trigger()).toHaveFocus());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(
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

  it("opens on mount with defaultOpen", async () => {
    render(<Basic rootProps={{ defaultOpen: true }} />);
    await expectOpen();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
  });

  it("takes the page behind out of reach and locks scroll, then restores both", async () => {
    const outsideUnreachable = () => {
      for (let el: Element | null = outside(); el; el = el.parentElement) {
        if (
          (el as HTMLElement).inert ||
          el.getAttribute("aria-hidden") === "true"
        ) {
          return true;
        }
      }
      return false;
    };
    const scrollLocked = () =>
      [document.documentElement, document.body].some(
        (el) =>
          el.style.overflow === "hidden" || el.style.overflowY === "hidden",
      );

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
});

describe("AlertDialog handle", () => {
  it("opens from a handle with no trigger and returns focus to the opener", async () => {
    function View() {
      const [handle] = React.useState(() => AlertDialogCreateHandle());
      return (
        <>
          <button type="button" onClick={() => handle.open(null)}>
            Ask first
          </button>
          <AlertDialog handle={handle}>
            <AlertDialogContent>
              <AlertDialogTitle>Delete task</AlertDialogTitle>
              <AlertDialogClose>Cancel</AlertDialogClose>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    }
    render(<View />);
    const opener = screen.getByRole("button", { name: "Ask first" });

    act(() => opener.focus());
    fireEvent.click(opener);
    await expectOpen();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );

    key(document.activeElement as Element, "Escape");
    await expectClosed();
    // The opener had focus before the dialog opened, so it gets it back.
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("opens and closes from a handle shared by a detached trigger", async () => {
    function View() {
      const [handle] = React.useState(() => AlertDialogCreateHandle());
      return (
        <>
          <AlertDialogTrigger handle={handle} id="detached">
            Detached open
          </AlertDialogTrigger>
          <AlertDialog handle={handle}>
            <AlertDialogContent>
              <AlertDialogTitle>Detached</AlertDialogTitle>
              <AlertDialogClose>Cancel</AlertDialogClose>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    }
    render(<View />);
    // Referenced before opening: a modal dialog hides the page from queries.
    const detached = screen.getByRole("button", { name: "Detached open" });

    press(detached);
    await expectOpen();
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName("Detached");

    key(document.activeElement as Element, "Escape");
    await expectClosed();
    await waitFor(() => expect(detached).toHaveFocus());
  });

  it("closes from the handle and returns focus to the opener", async () => {
    function View() {
      const [handle] = React.useState(() => AlertDialogCreateHandle());
      return (
        <>
          <button type="button" onClick={() => handle.open(null)}>
            Ask first
          </button>
          <button type="button" onClick={() => handle.close()}>
            Close it
          </button>
          <AlertDialog handle={handle}>
            <AlertDialogContent>
              <AlertDialogTitle>Delete task</AlertDialogTitle>
              <AlertDialogClose>Cancel</AlertDialogClose>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    }
    render(<View />);
    const opener = screen.getByRole("button", { name: "Ask first" });
    const closer = screen.getByRole("button", { name: "Close it" });
    act(() => opener.focus());
    fireEvent.click(opener);
    await expectOpen();

    // Closing from the handle while focus is elsewhere still returns focus to
    // the opener, as the task view does when its task goes away.
    fireEvent.click(closer);
    await expectClosed();
    await waitFor(() => expect(opener).toHaveFocus());
  });
});

describe("AlertDialog and forms", () => {
  it("Enter on a trigger inside a form opens the dialog without submitting the form", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    function View() {
      const [handle] = React.useState(() => AlertDialogCreateHandle());
      return (
        <>
          <form onSubmit={onSubmit}>
            <input aria-label="Name" />
            <AlertDialogTrigger handle={handle} id="in-form">
              Open alert
            </AlertDialogTrigger>
            <button type="submit">Save</button>
          </form>
          <AlertDialog handle={handle}>
            <AlertDialogContent>
              <AlertDialogTitle>Delete task</AlertDialogTitle>
              <AlertDialogClose>Cancel</AlertDialogClose>
              <AlertDialogClose value="confirm">Delete</AlertDialogClose>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    }
    render(<View />);
    const button = screen.getByRole("button", { name: "Open alert" });

    act(() => button.focus());
    expect(key(button, "Enter"), "Enter must reach the button").toBe(true);
    await expectOpen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Enter on a Close part inside a form closes the dialog without submitting it", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    function View() {
      const [handle] = React.useState(() => AlertDialogCreateHandle());
      return (
        <>
          <button type="button" onClick={() => handle.open(null)}>
            Ask first
          </button>
          <AlertDialog handle={handle}>
            <AlertDialogContent>
              <AlertDialogTitle>Delete task</AlertDialogTitle>
              <form onSubmit={onSubmit}>
                <AlertDialogClose>Cancel</AlertDialogClose>
                <button type="submit">Save</button>
              </form>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    }
    render(<View />);
    press(screen.getByRole("button", { name: "Ask first" }));
    await expectOpen();

    expect(
      key(screen.getByRole("button", { name: "Cancel" }), "Enter"),
      "Enter must reach the button",
    ).toBe(true);
    await expectClosed();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("negative control: a plain button in the same form does submit on Enter", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <button type="submit">Save</button>
      </form>,
    );
    key(screen.getByRole("button", { name: "Save" }), "Enter");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("AlertDialog disabled", () => {
  it("a disabled trigger is natively disabled, not focusable, and does not open", async () => {
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
      <Basic footer={<AlertDialogClose disabled>Locked</AlertDialogClose>} />,
    );
    await openByClick();
    const locked = screen.getByRole("button", { name: "Locked" });
    expect(locked).toBeDisabled();
    press(locked);
    await act(async () => {});
    expect(openDialog()).not.toBeNull();
  });
});

describe("AlertDialog exports kept for callers", () => {
  it("keeps Portal, Viewport and Overlay as usable parts", async () => {
    expect(AlertDialogOverlay).toBeDefined();
    render(
      <AlertDialog defaultOpen>
        <AlertDialogPortal>
          <AlertDialogViewport>
            <AlertDialogContent>
              <AlertDialogTitle>Parts</AlertDialogTitle>
              <AlertDialogClose>Cancel</AlertDialogClose>
            </AlertDialogContent>
          </AlertDialogViewport>
        </AlertDialogPortal>
      </AlertDialog>,
    );
    await expectOpen();
    expect(
      screen.getByRole("alertdialog", { name: "Parts" }),
    ).toBeInTheDocument();
  });
});

describe("AlertDialog event containment", () => {
  it("contains pointer and command events in the content and the backdrop", async () => {
    await expectPopupContainment({
      render: ({ containEvents, contentProps, control }) => (
        <AlertDialog>
          <AlertDialogTrigger>Open alert</AlertDialogTrigger>
          <AlertDialogContent {...contentProps} containEvents={containEvents}>
            <AlertDialogTitle>Contained</AlertDialogTitle>
            {control}
            <AlertDialogClose>Cancel</AlertDialogClose>
          </AlertDialogContent>
        </AlertDialog>
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
