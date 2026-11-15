/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The ancestor elements stand in for a clickable row around a dialog; they are
   probes, not interactive UI. */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Fragment, type ReactElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  Command,
  CommandCreateHandle,
  CommandDialog,
  CommandDialogPopup,
  CommandDialogTrigger,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "./command";
import { expectPopupContainment } from "./popup-containment-test-utils";

afterEach(cleanup);

type Entry = { id: string; label: string };
type Group = { value: string; label: string; items: Entry[] };

const GROUPS: Group[] = [
  {
    value: "fruit",
    label: "Fruit",
    items: [
      { id: "apple", label: "Apple" },
      { id: "apricot", label: "Apricot" },
      { id: "banana", label: "Banana" },
    ],
  },
  {
    value: "veg",
    label: "Vegetables",
    items: [{ id: "carrot", label: "Carrot" }],
  },
];

/**
 * One place that knows how callers wire the list. Only this component changes
 * between the Base UI and the UI SDK wrapper (record section 12): the props
 * that carry the data, the query and the run callback.
 */
function List({
  groups = GROUPS,
  onRun,
  noFilter = false,
  initialQuery = "",
  onQuery,
}: {
  groups?: Group[];
  onRun?: (id: string) => void;
  noFilter?: boolean;
  initialQuery?: string;
  onQuery?: (query: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  return (
    <Command
      filter={noFilter ? null : undefined}
      query={query}
      onQueryChange={(next) => {
        setQuery(next);
        onQuery?.(next);
      }}
    >
      <CommandInput aria-label="Search" placeholder="Search" />
      <CommandPanel>
        <CommandEmpty>Nothing found</CommandEmpty>
        <CommandList>
          {groups.map((group, groupIndex) => (
            <Fragment key={group.value}>
              <CommandGroup>
                <CommandGroupLabel>{group.label}</CommandGroupLabel>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.label}
                    onSelect={() => onRun?.(item.id)}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              {groupIndex < groups.length - 1 && <CommandSeparator />}
            </Fragment>
          ))}
        </CommandList>
      </CommandPanel>
    </Command>
  );
}

// UI SDK settles the highlight and the empty state in a microtask.
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });
async function show(ui: ReactElement) {
  render(ui);
  await flush();
}
async function change(value: string) {
  fireEvent.change(input(), { target: { value } });
  await flush();
}
async function press(key: string) {
  fireEvent.keyDown(input(), { key });
  await flush();
}

// UI SDK hides an emptied group with `hidden`; Base UI left it out of the page.
const shown = (text: string) => {
  const element = screen.queryByText(text);
  return element !== null && element.closest("[hidden]") === null;
};
const separators = () =>
  document.querySelectorAll("[data-slot=command-separator]");
const input = () => screen.getByRole("combobox", { name: "Search" });
const names = () => screen.queryAllByRole("option").map((o) => o.textContent);
const highlighted = () =>
  screen
    .queryAllByRole("option")
    .filter((o) => o.hasAttribute("data-highlighted"))
    .map((o) => o.textContent);

describe("Command list", () => {
  it("shows every item and highlights the first with an empty field", async () => {
    await show(<List />);

    expect(names()).toEqual(["Apple", "Apricot", "Banana", "Carrot"]);
    expect(highlighted()).toEqual(["Apple"]);
    expect(screen.getByText("Fruit")).toBeInTheDocument();
    expect(screen.getByText("Vegetables")).toBeInTheDocument();
  });

  it("filters by contains as the text changes and highlights the first match", async () => {
    await show(<List />);

    // "ap" is inside Apple and Apricot. A fuzzy filter would also keep Banana
    // (a-p-... no) but "ana" must not match Apple by letters in order.
    await change("ap");
    expect(names()).toEqual(["Apple", "Apricot"]);
    expect(highlighted()).toEqual(["Apple"]);

    await change("nan");
    expect(names()).toEqual(["Banana"]);
    expect(highlighted()).toEqual(["Banana"]);

    await change("");
    expect(names()).toHaveLength(4);
    expect(highlighted()).toEqual(["Apple"]);
  });

  it("does not match letters that are only in order (contains, not fuzzy)", async () => {
    await show(<List />);

    // a, p, t... "aae" are in order inside Apple but are not a substring.
    await change("ale");

    expect(names()).toEqual([]);
  });

  it("moves the highlight with ArrowDown and ArrowUp", async () => {
    await show(<List />);

    await press("ArrowDown");
    expect(highlighted()).toEqual(["Apricot"]);
    await press("ArrowDown");
    expect(highlighted()).toEqual(["Banana"]);
    await press("ArrowUp");
    expect(highlighted()).toEqual(["Apricot"]);
  });

  it("runs the highlighted item on Enter, once", async () => {
    const onRun = vi.fn();
    await show(<List onRun={onRun} />);

    await press("ArrowDown");
    await press("Enter");

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith("apricot");
  });

  it("runs the first match on Enter after typing", async () => {
    const onRun = vi.fn();
    await show(<List onRun={onRun} />);

    await change("carr");
    await press("Enter");

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith("carrot");
  });

  it("runs an item on click, once", async () => {
    const onRun = vi.fn();
    await show(<List onRun={onRun} />);

    fireEvent.click(screen.getByRole("option", { name: "Banana" }));
    await flush();

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith("banana");
  });

  it("shows the empty part only when nothing matches", async () => {
    await show(<List />);
    expect(screen.queryByText("Nothing found")).not.toBeInTheDocument();

    await change("zzz");

    expect(screen.getByText("Nothing found")).toBeInTheDocument();
    expect(names()).toEqual([]);
  });

  it("hides a group and its label when the filter leaves it empty", async () => {
    await show(<List />);

    await change("carr");

    expect(names()).toEqual(["Carrot"]);
    expect(shown("Vegetables")).toBe(true);
    expect(shown("Fruit")).toBe(false);
  });

  it("shows a separator between groups that both have matches", async () => {
    await show(<List />);

    expect(separators()).toHaveLength(1);
  });

  it("keeps every item with no filter, as a server-filtered list needs", async () => {
    await show(<List noFilter />);

    await change("zzz");

    expect(names()).toEqual(["Apple", "Apricot", "Banana", "Carrot"]);
    expect(screen.queryByText("Nothing found")).not.toBeInTheDocument();
  });

  it("shows the empty part with no filter and no items", async () => {
    await show(<List groups={[]} noFilter />);

    expect(names()).toEqual([]);
    expect(screen.getByText("Nothing found")).toBeInTheDocument();
  });

  it("clears a non-empty query on the first Escape and closes on the second", async () => {
    const onOpenChange = vi.fn();
    const onQuery = vi.fn();
    function Palette() {
      const [open, setOpen] = useState(false);
      return (
        <CommandDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            onOpenChange(next);
          }}
        >
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <CommandDialogPopup>
            <List onQuery={onQuery} />
          </CommandDialogPopup>
        </CommandDialog>
      );
    }

    await show(<Palette />);
    fireEvent.click(screen.getByText("Open"));
    await flush();

    await change("car");
    expect(names()).toEqual(["Carrot"]);

    // Record section 12: the command clears its query and calls
    // preventDefault, so the UI SDK dialog layer skips the same key press.
    await press("Escape");
    expect(onQuery).toHaveBeenLastCalledWith("");
    expect(input()).toHaveValue("");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(names()).toEqual(["Apple", "Apricot", "Banana", "Carrot"]);

    await press("Escape");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a controlled query in the field and reports typing", async () => {
    const onQuery = vi.fn();
    await show(<List initialQuery="an" onQuery={onQuery} />);

    expect(input()).toHaveValue("an");

    await change("ca");
    expect(input()).toHaveValue("ca");
    expect(onQuery).toHaveBeenLastCalledWith("ca");
    expect(names()).toEqual(["Carrot"]);
  });

  it("moves the highlight back to the first row when the rows change", async () => {
    await show(<List />);
    await press("ArrowDown");
    await press("ArrowDown");
    expect(highlighted()).toEqual(["Banana"]);

    // Banana drops out, so the highlight cannot stay on it.
    await change("r");

    expect(names()).toEqual(["Apricot", "Carrot"]);
    expect(highlighted()).toEqual(["Apricot"]);
  });

  it("never submits a surrounding form on Enter (trap 1)", async () => {
    const clicked = vi.fn();
    const submitted = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    await show(
      <form onSubmit={submitted}>
        <List />
        <button type="submit" onClick={clicked}>
          Save
        </button>
      </form>,
    );

    const allowed = fireEvent.keyDown(input(), { key: "Enter" });

    expect(allowed).toBe(false);
    expect(clicked).not.toHaveBeenCalled();
    expect(submitted).not.toHaveBeenCalled();
  });

  it("negative control: a plain Enter handler that clicks submit is seen", async () => {
    const clicked = vi.fn();
    render(
      <form>
        <input
          aria-label="plain"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.form
                ?.querySelector<HTMLButtonElement>("button[type=submit]")
                ?.click();
            }
          }}
        />
        <button type="submit" onClick={clicked}>
          Save
        </button>
      </form>,
    );

    fireEvent.keyDown(screen.getByLabelText("plain"), { key: "Enter" });

    expect(clicked).toHaveBeenCalledTimes(1);
  });
});

// Record section 4: the popup slot is `dialog-content`, the backdrop
// `dialog-backdrop` and the trigger `dialog-trigger`.
const SLOT = {
  content: "dialog-content",
  backdrop: "dialog-backdrop",
  trigger: "dialog-trigger",
};

type OpenChange = (open: boolean, details: { reason?: string }) => void;

/**
 * One place that knows how callers wire the dialog parts. Only the props and
 * the slot names differ between dialogs.
 */
function Palette({
  onOpenChange,
  popupProps,
  triggerProps,
  children,
  triggerLabel = "Open palette",
}: {
  onOpenChange?: OpenChange;
  popupProps?: Partial<React.ComponentProps<typeof CommandDialogPopup>>;
  triggerProps?: Partial<React.ComponentProps<typeof CommandDialogTrigger>>;
  children?: React.ReactNode;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <CommandDialog
      open={open}
      onOpenChange={(next, details) => {
        setOpen(next);
        onOpenChange?.(next, details as { reason?: string });
      }}
    >
      <CommandDialogTrigger {...triggerProps}>
        {triggerLabel}
      </CommandDialogTrigger>
      <CommandDialogPopup {...popupProps}>
        {children ?? <List />}
      </CommandDialogPopup>
    </CommandDialog>
  );
}

const trigger = () => screen.getByRole("button", { name: "Open palette" });

/** The open dialog content. A closing one keeps `data-closed` for its exit. */
const openDialogs = () =>
  [
    ...document.querySelectorAll<HTMLElement>(`[data-slot="${SLOT.content}"]`),
  ].filter((el) => !el.hasAttribute("data-closed") && !el.hidden);
const dialogContent = () => openDialogs().at(-1) ?? null;
const backdrop = () =>
  document.querySelector<HTMLElement>(`[data-slot="${SLOT.backdrop}"]`);

async function expectOpen() {
  await waitFor(() => expect(dialogContent()).not.toBeNull());
}
async function expectClosed() {
  await waitFor(() => expect(openDialogs()).toHaveLength(0));
}

/** A real mouse press: pointer and mouse events, then the click. */
function pressOn(element: Element) {
  fireEvent.pointerDown(element, { pointerType: "mouse", button: 0 });
  fireEvent.mouseDown(element, { button: 0 });
  fireEvent.pointerUp(element, { pointerType: "mouse", button: 0 });
  fireEvent.mouseUp(element, { button: 0 });
  fireEvent.click(element, { button: 0 });
}

/**
 * A key press the way a browser runs it. jsdom does not run the default action
 * of Enter or Space, so this does: a native button gets its click, only when
 * the keydown was not cancelled.
 */
function key(element: Element, name: string) {
  const proceed = fireEvent.keyDown(element, { key: name });
  if (name === " ") fireEvent.keyUp(element, { key: name });
  if (!proceed) return false;
  if (element instanceof HTMLButtonElement && name === "Enter") {
    fireEvent.click(element);
    return true;
  }
  return false;
}

const escape = () =>
  fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });

describe("Command dialog", () => {
  it("opens from the trigger, names the dialog and closes on Escape", async () => {
    const onOpenChange = vi.fn();
    await show(
      <Palette
        onOpenChange={onOpenChange}
        popupProps={{ "aria-label": "Command palette" }}
      />,
    );

    const button = trigger();
    expect(button).toHaveAttribute("data-slot", SLOT.trigger);
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(dialogContent()).toBeNull();

    pressOn(button);
    await expectOpen();

    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    expect(dialog).toBe(dialogContent());
    expect(dialog).toHaveAttribute("data-slot", SLOT.content);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(onOpenChange).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ reason: "trigger-press" }),
    );

    // The search field takes focus, so a key press reaches the dialog.
    expect(input()).toHaveFocus();
    escape();
    await expectClosed();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );
  });

  it("moves focus into the search field and back to the trigger by default", async () => {
    await show(<Palette />);
    const button = trigger();
    act(() => button.focus());

    pressOn(button);
    await expectOpen();
    await waitFor(() => expect(input()).toHaveFocus());

    escape();
    await expectClosed();
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("keeps focus off the trigger with finalFocus={false}", async () => {
    await show(<Palette popupProps={{ finalFocus: false }} />);
    const button = trigger();
    act(() => button.focus());

    pressOn(button);
    await expectOpen();
    await waitFor(() => expect(input()).toHaveFocus());

    escape();
    await expectClosed();
    await act(async () => {});
    expect(button).not.toHaveFocus();
  });

  it("renders a backdrop and closes on a press on it", async () => {
    const onOpenChange = vi.fn();
    await show(<Palette onOpenChange={onOpenChange} />);

    pressOn(trigger());
    await expectOpen();
    const layer = backdrop();
    expect(layer).not.toBeNull();

    pressOn(layer as Element);
    await expectClosed();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "outside-press" }),
    );
  });

  it("skips the open animation with instant and animates without it", async () => {
    const first = render(<Palette popupProps={{ instant: true }} />);
    pressOn(trigger());
    await expectOpen();
    expect(dialogContent()).toHaveClass("transition-none");
    expect(backdrop()).toHaveClass("transition-none");
    first.unmount();
    cleanup();

    render(<Palette />);
    pressOn(trigger());
    await expectOpen();
    expect(dialogContent()).not.toHaveClass("transition-none");
    expect(backdrop()).not.toHaveClass("transition-none");
  });

  it("applies a caller's className to the content", async () => {
    await show(<Palette popupProps={{ className: "max-w-md" }} />);

    pressOn(trigger());
    await expectOpen();
    expect(dialogContent()).toHaveClass("max-w-md");
  });

  it("a disabled trigger is natively disabled, is skipped by Tab and does not open (trap 2)", async () => {
    const onOpenChange = vi.fn();
    await show(
      <Palette triggerProps={{ disabled: true }} onOpenChange={onOpenChange} />,
    );

    const button = trigger();
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    act(() => button.focus());
    expect(button).not.toHaveFocus();

    pressOn(button);
    key(button, "Enter");
    await act(async () => {});

    expect(dialogContent()).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Enter on the trigger and in the list does not submit a form around it (trap 1)", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onRun = vi.fn();
    // Record rule 8: a UI SDK dialog renders in place, so content that sits in
    // a form would nest forms. This usage moves it to the body.
    const container = document.body;
    render(
      <form onSubmit={onSubmit}>
        <Palette popupProps={{ container }}>
          <List onRun={onRun} />
        </Palette>
        <button type="submit">Save</button>
      </form>,
    );

    act(() => trigger().focus());
    key(trigger(), "Enter");
    await expectOpen();
    expect(onSubmit).not.toHaveBeenCalled();

    // Enter runs the highlighted item instead of submitting the form.
    expect(input()).toHaveFocus();
    fireEvent.keyDown(input(), { key: "Enter" });
    await flush();
    expect(onRun).toHaveBeenCalledTimes(1);
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

  it("warns when its content sits inside a button, and not in a plain div (trap 4)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // The outer button takes the trigger's accessible name too, so this test
    // finds the trigger by its slot.
    const nestedTrigger = () =>
      document.querySelector<HTMLElement>('[data-slot="dialog-trigger"]');
    try {
      const nested = render(
        <button type="button">
          <Palette />
        </button>,
      );
      pressOn(nestedTrigger() as Element);
      await expectOpen();
      pressOn(input());
      expect(error.mock.calls.flat().join(" ")).toContain(
        "[popup-containment]",
      );
      nested.unmount();
      cleanup();
      error.mockClear();

      render(
        <div>
          <Palette />
        </div>,
      );
      pressOn(trigger());
      await expectOpen();
      pressOn(input());
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});

describe("Command dialog handle", () => {
  it("opens and closes from a handle, with a detached trigger", async () => {
    const handle = CommandCreateHandle();
    render(
      <>
        <CommandDialogTrigger handle={handle}>
          Open palette
        </CommandDialogTrigger>
        <CommandDialog handle={handle}>
          <CommandDialogPopup>
            <List />
          </CommandDialogPopup>
        </CommandDialog>
      </>,
    );
    expect(handle.isOpen).toBe(false);

    act(() => handle.openWithPayload(undefined));
    await expectOpen();
    expect(handle.isOpen).toBe(true);

    act(() => handle.close());
    await expectClosed();
    expect(handle.isOpen).toBe(false);
  });
});

describe("Command dialog event containment", () => {
  it("contains pointer and command events in the content and the backdrop", async () => {
    await expectPopupContainment({
      render: ({ containEvents, contentProps, control }) => (
        <Palette
          popupProps={{
            ...contentProps,
            containEvents,
            "aria-label": "Contained",
          }}
        >
          {control}
        </Palette>
      ),
      open: async () => {
        pressOn(trigger());
        await expectOpen();
      },
      content: () => dialogContent() as Element,
      backdrop: () => backdrop(),
    });
  });

  it("a press on the backdrop does not reach a clickable row around the dialog", async () => {
    const onClick = vi.fn();
    render(
      <div onClick={onClick}>
        <Palette />
      </div>,
    );
    pressOn(trigger());
    await expectOpen();
    onClick.mockClear();

    pressOn(backdrop() as Element);

    expect(onClick).not.toHaveBeenCalled();
  });
});
