/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The ancestor div stands in for a clickable card or form row around a popup;
   it is a probe, not interactive UI. */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { Dialog, DialogPopup } from "./dialog";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "./popover";
import { expectPopupContainment } from "./popup-containment-test-utils";
import {
  Select,
  SelectButton,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const FRUITS = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
  { value: "blueberry", label: "Blueberry" },
];

// The popup slot on UI SDK.
const SLOT = "select-content";

// Base UI mounts the list only while it is open. UI SDK keeps the content in
// the page and marks it data-closed while it is hidden. Both count as shown
// only when the listbox is mounted and not closed.
function shownListbox() {
  for (const list of document.querySelectorAll('[role="listbox"]')) {
    if (list.closest("[data-closed], [hidden]")) continue;
    return list as HTMLElement;
  }
  return null;
}

function shownOptions() {
  const list = shownListbox();
  if (!list) return [];
  return Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
}

function optionLabels() {
  return shownOptions().map((option) => option.textContent?.trim());
}

function highlighted() {
  return shownOptions().find((option) =>
    option.hasAttribute("data-highlighted"),
  );
}

// A full mouse press. Base UI opens on mousedown, UI SDK on pointerdown or
// click; firing all of them once is what a real click sends.
function press(element: Element) {
  fireEvent.pointerDown(element, { pointerType: "mouse", button: 0 });
  fireEvent.mouseDown(element, { button: 0 });
  fireEvent.pointerUp(element, { pointerType: "mouse", button: 0 });
  fireEvent.mouseUp(element, { button: 0 });
  fireEvent.click(element, { button: 0 });
}

function key(element: Element, name: string) {
  fireEvent.keyDown(element, { key: name, code: name });
  fireEvent.keyUp(element, { key: name, code: name });
}

// A button runs its click on Enter (keydown) and Space (keyup) unless the key
// event was prevented. jsdom does not do this, so a keyboard test that never
// clicks cannot tell a working opener from an inert one (trap 5). This sends
// the browser's sequence and clicks only when the library left the key alone.
function activateWithKey(element: Element, name: "Enter" | " ") {
  const down = fireEvent.keyDown(element, { key: name, code: name });
  if (name === "Enter") {
    if (down) fireEvent.click(element);
    return;
  }
  const up = fireEvent.keyUp(element, { key: name, code: name });
  if (down && up) fireEvent.click(element);
}

function trigger(name = "Fruit") {
  return screen.getByRole("combobox", { name });
}

// Focus and the first highlight land a frame after the list mounts. Keys go to
// whatever holds focus, as for a person, so wait for it to settle first.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

function active() {
  return document.activeElement ?? document.body;
}

async function openByClick(name = "Fruit") {
  press(trigger(name));
  await waitFor(() => expect(shownListbox()).not.toBeNull());
  await settle();
}

async function openByKey(name = "ArrowDown") {
  const element = trigger();
  act(() => element.focus());
  key(element, name);
  await waitFor(() => expect(shownListbox()).not.toBeNull());
  await settle();
}

function option(label: string) {
  const found = shownOptions().find(
    (item) => item.textContent?.trim() === label,
  );
  if (!found) throw new Error(`no shown option "${label}"`);
  return found;
}

type FruitProps = {
  defaultValue?: string | null;
  value?: string | null;
  disabled?: boolean;
  name?: string;
  onValueChange?: (value: unknown, details?: unknown) => void;
  disabledItem?: string;
  items?: typeof FRUITS | Record<string, string> | null;
  valueChildren?: React.ComponentProps<typeof SelectValue>["children"];
  alignItemWithTrigger?: boolean;
  containEvents?: boolean;
  contentProps?: Record<string, unknown>;
  control?: React.ReactNode;
  modal?: boolean;
  onOpenChange?: (open: boolean, details?: unknown) => void;
};

function Fruit({
  defaultValue,
  value,
  disabled,
  name,
  onValueChange,
  disabledItem,
  items,
  valueChildren,
  alignItemWithTrigger,
  containEvents,
  contentProps,
  control,
  modal,
  onOpenChange,
}: FruitProps) {
  // The disabled flag goes on the item part and, for UI SDK, on its data too.
  const data =
    items === null
      ? undefined
      : (items ??
        FRUITS.map((fruit) =>
          fruit.value === disabledItem ? { ...fruit, disabled: true } : fruit,
        ));
  const rootProps: Record<string, unknown> = {};
  if (value !== undefined) rootProps.value = value;
  else if (defaultValue !== undefined) rootProps.defaultValue = defaultValue;
  const popupProps: Record<string, unknown> = { ...contentProps };
  if (alignItemWithTrigger !== undefined) {
    popupProps.alignItemWithTrigger = alignItemWithTrigger;
  }
  if (containEvents !== undefined) popupProps.containEvents = containEvents;

  return (
    <Select
      disabled={disabled}
      items={data}
      modal={modal}
      name={name}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      {...rootProps}
    >
      <SelectTrigger aria-label="Fruit">
        <SelectValue placeholder="Pick a fruit">{valueChildren}</SelectValue>
      </SelectTrigger>
      <SelectContent {...popupProps}>
        {control}
        {FRUITS.map((fruit) => (
          <SelectItem
            disabled={fruit.value === disabledItem}
            key={fruit.value}
            value={fruit.value}
          >
            {fruit.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

describe("Select roles and value", () => {
  it("exposes a combobox trigger that opens a listbox of options", async () => {
    render(<Fruit />);

    expect(trigger()).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(shownListbox()).toBeNull();

    await openByClick();

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(optionLabels()).toEqual(["Apple", "Banana", "Cherry", "Blueberry"]);
  });

  it("shows the selected label before the list has ever opened", () => {
    render(<Fruit defaultValue="banana" />);

    expect(trigger()).toHaveTextContent("Banana");
    expect(shownListbox()).toBeNull();
  });

  it("shows the placeholder, marked as a placeholder, while the value is empty", () => {
    render(<Fruit defaultValue={null} />);

    expect(trigger()).toHaveTextContent("Pick a fruit");
    expect(trigger().hasAttribute("data-placeholder")).toBe(true);
  });

  it("shows explicit SelectValue children before the list has opened", () => {
    render(<Fruit defaultValue="cherry" valueChildren="Custom: Cherry" />);

    expect(trigger()).toHaveTextContent("Custom: Cherry");
  });

  it("calls SelectValue function children with the selected value", () => {
    render(
      <Fruit
        defaultValue="cherry"
        valueChildren={(selected) => `Got ${String(selected)}`}
      />,
    );

    expect(trigger()).toHaveTextContent("Got cherry");
  });

  it("takes an items record, as three call sites pass one", () => {
    render(
      <Fruit
        defaultValue="b"
        items={{ a: "Alpha", b: "Bravo" } as unknown as typeof FRUITS}
      />,
    );

    expect(trigger()).toHaveTextContent("Bravo");
  });

  it("marks the selected option and reports a string value first", async () => {
    const onValueChange = vi.fn();
    render(<Fruit defaultValue="apple" onValueChange={onValueChange} />);

    await openByClick();
    expect(option("Apple")).toHaveAttribute("aria-selected", "true");
    expect(option("Banana")).toHaveAttribute("aria-selected", "false");

    press(option("Cherry"));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("cherry");
    await waitFor(() => expect(shownListbox()).toBeNull());
    expect(trigger()).toHaveTextContent("Cherry");
  });

  it("follows a controlled value and does not change it by itself", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Fruit onValueChange={onValueChange} value="apple" />,
    );
    expect(trigger()).toHaveTextContent("Apple");

    await openByClick();
    press(option("Banana"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("banana");
    await waitFor(() => expect(shownListbox()).toBeNull());
    expect(trigger()).toHaveTextContent("Apple");

    rerender(<Fruit onValueChange={onValueChange} value="banana" />);
    expect(trigger()).toHaveTextContent("Banana");
  });

  it("shows the placeholder again when a controlled value goes back to null", () => {
    const { rerender } = render(<Fruit value="apple" />);
    expect(trigger()).toHaveTextContent("Apple");

    rerender(<Fruit value={null} />);
    expect(trigger()).toHaveTextContent("Pick a fruit");
  });

  it("maps the Base UI itemToString props for object values", async () => {
    type Person = { id: string; name: string };
    const ada: Person = { id: "ada", name: "Ada" };
    const lin: Person = { id: "lin", name: "Lin" };
    const onValueChange = vi.fn();
    render(
      <Select<Person>
        defaultValue={ada}
        itemToStringLabel={(person) => person.name}
        itemToStringValue={(person) => person.id}
        items={[
          { label: "Ada", value: ada },
          { label: "Lin", value: lin },
        ]}
        onValueChange={onValueChange}
      >
        <SelectTrigger aria-label="Person">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ada}>Ada</SelectItem>
          <SelectItem value={lin}>Lin</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(trigger("Person")).toHaveTextContent("Ada");
    await openByClick("Person");
    press(option("Lin"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe(lin);
  });

  it("keeps the SelectPopup alias for SelectContent", () => {
    expect(SelectPopup).toBe(SelectContent);
  });
});

describe("Select modal", () => {
  // Base UI's Select was modal by default: page scroll locked while open. UI
  // SDK defaults to a pointer-only modal, so the wrapper sets it back.
  // How "modal is engaged" shows: UI SDK locks scroll on <html>. Base UI's
  // scroll lock needs a real scrollbar, which jsdom has none of, so there the
  // sign is its inert overlay around the page.
  const locked = () => document.documentElement.style.overflow === "hidden";

  it("locks page scroll while open and releases it on close", async () => {
    render(<Fruit />);
    expect(locked()).toBe(false);

    await openByClick();
    await waitFor(() => expect(locked()).toBe(true));

    key(active(), "Escape");
    await waitFor(() => expect(shownListbox()).toBeNull());
    await waitFor(() => expect(locked()).toBe(false));
  });

  // Base UI's Select has no modal prop (always modal), so the opt-out is a
  // UI SDK addition and runs on the ported wrapper only.
  it("does not lock page scroll with modal={false}", async () => {
    render(<Fruit modal={false} />);

    await openByClick();
    expect(shownListbox()).not.toBeNull();
    expect(locked()).toBe(false);
  });
});

describe("Select opening keys", () => {
  it.each(["Enter", " "])(
    "opens on %j, moves focus into the list, and reports open changes as booleans",
    async (name) => {
      const onOpenChange = vi.fn();
      render(<Fruit defaultValue="banana" onOpenChange={onOpenChange} />);

      act(() => trigger().focus());
      activateWithKey(trigger(), name as "Enter" | " ");
      await waitFor(() => expect(shownListbox()).not.toBeNull());
      await settle();

      expect(shownListbox()?.contains(active())).toBe(true);
      expect(onOpenChange.mock.calls.map((call) => call[0])).toEqual([true]);

      key(active(), "Escape");
      await waitFor(() => expect(shownListbox()).toBeNull());
      expect(onOpenChange.mock.calls.map((call) => call[0])).toEqual([
        true,
        false,
      ]);
    },
  );
});

describe("Select keyboard", () => {
  it("opens on ArrowDown, moves the highlight, and chooses with Enter", async () => {
    const onValueChange = vi.fn();
    render(<Fruit onValueChange={onValueChange} />);

    await openByKey("ArrowDown");
    key(active(), "ArrowDown");
    key(active(), "ArrowDown");

    expect(highlighted()).toBeDefined();
    const label = highlighted()?.textContent?.trim();
    expect(["Banana", "Cherry"]).toContain(label);

    key(active(), "Enter");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe(
      label === "Banana" ? "banana" : "cherry",
    );
    await waitFor(() => expect(shownListbox()).toBeNull());
  });

  it("moves to the last option on End and the first on Home", async () => {
    render(<Fruit defaultValue="banana" />);

    await openByKey("ArrowDown");

    key(active(), "End");
    expect(highlighted()?.textContent?.trim()).toBe("Blueberry");

    key(active(), "Home");
    expect(highlighted()?.textContent?.trim()).toBe("Apple");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<Fruit />);

    await openByClick();
    key(active(), "Escape");

    await waitFor(() => expect(shownListbox()).toBeNull());
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("returns focus to the trigger after choosing an option", async () => {
    render(<Fruit />);

    await openByClick();
    press(option("Apple"));

    await waitFor(() => expect(shownListbox()).toBeNull());
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("closes on a press outside and keeps the value", async () => {
    const onValueChange = vi.fn();
    render(
      <div>
        <button type="button">Outside</button>
        <Fruit defaultValue="apple" onValueChange={onValueChange} />
      </div>,
    );

    await openByClick();
    press(screen.getByRole("button", { name: "Outside" }));

    await waitFor(() => expect(shownListbox()).toBeNull());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent("Apple");
  });

  it("highlights the item that matches typing when the select has no items data", async () => {
    render(<Fruit items={null} valueChildren="Pick" />);

    await openByClick();
    key(active(), "b");
    expect(highlighted()?.textContent?.trim()).toBe("Banana");
    key(active(), "b");
    expect(highlighted()?.textContent?.trim()).toBe("Blueberry");
  });

  it("highlights the item that matches typing while the list is open", async () => {
    render(<Fruit />);

    await openByClick();
    key(active(), "c");

    expect(highlighted()?.textContent?.trim()).toBe("Cherry");
  });

  // Base UI 1.9 mounts items only while open, so a closed trigger has no
  // labels to match and selects nothing in jsdom. UI SDK documents this
  // typeahead; the test runs on the ported wrapper only.
  it("selects the next match when typing on the closed, focused trigger", async () => {
    const onValueChange = vi.fn();
    render(<Fruit onValueChange={onValueChange} />);

    act(() => trigger().focus());
    key(trigger(), "c");

    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    expect(onValueChange.mock.calls[0]?.[0]).toBe("cherry");
    expect(shownListbox()).toBeNull();
    expect(trigger()).toHaveTextContent("Cherry");
  });
});

describe("Select disabled", () => {
  it("renders a disabled trigger that is not focusable and does not open", () => {
    render(<Fruit disabled />);

    const element = trigger();
    // Trap 2: native `disabled`, not aria-disabled on a focusable button.
    expect(element).toBeDisabled();
    expect(element.hasAttribute("disabled")).toBe(true);
    act(() => element.focus());
    expect(element).not.toHaveFocus();

    press(element);
    key(element, "ArrowDown");
    expect(shownListbox()).toBeNull();
    expect(element.hasAttribute("data-disabled")).toBe(true);
  });

  it("marks a disabled item, does not choose it on a press, and still chooses others", async () => {
    const onValueChange = vi.fn();
    render(<Fruit disabledItem="banana" onValueChange={onValueChange} />);

    await openByClick();
    const banana = option("Banana");
    expect(banana).toHaveAttribute("aria-disabled", "true");
    expect(banana.hasAttribute("data-disabled")).toBe(true);

    press(banana);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(shownListbox()).not.toBeNull();

    // One contract for both libraries: arrows reach Cherry, and Enter on a
    // highlighted disabled item chooses nothing. Base UI let the highlight
    // land on the disabled item, so the Enter check runs there; UI SDK skips
    // it (see "Select added behavior").
    key(active(), "Home");
    const visited: (string | undefined)[] = [];
    for (let step = 0; step < 2; step += 1) {
      key(active(), "ArrowDown");
      visited.push(highlighted()?.textContent?.trim());
      if (highlighted()?.textContent?.trim() === "Banana") {
        key(active(), "Enter");
        expect(onValueChange).not.toHaveBeenCalled();
      }
    }
    expect(visited).toContain("Cherry");
    expect(shownListbox()).not.toBeNull();

    press(option("Cherry"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("cherry");
  });
});

// Added by UI SDK. Base UI 1.9 left a disabled item focusable and
// highlightable (aria-disabled, tabindex -1); UI SDK skips it on the arrows.
describe("Select added behavior", () => {
  it("skips a disabled item on the arrow keys", async () => {
    render(<Fruit disabledItem="banana" />);

    await openByClick();
    key(active(), "Home");
    const visited = [highlighted()?.textContent?.trim()];
    for (let step = 0; step < 3; step += 1) {
      key(active(), "ArrowDown");
      visited.push(highlighted()?.textContent?.trim());
    }
    expect(visited).not.toContain("Banana");
  });
});

function submitted(onSubmit: { mock: { calls: unknown[][] } }) {
  const data = onSubmit.mock.calls[0]?.[0];
  if (!(data instanceof FormData)) throw new Error("the form did not submit");
  return data.get("fruit");
}

describe("Select in a form", () => {
  function FormFixture({
    onSubmit,
    onValueChange,
  }: {
    onSubmit: (data: FormData) => void;
    onValueChange?: (value: unknown) => void;
  }) {
    return (
      <form
        data-testid="form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        <Fruit
          defaultValue="banana"
          name="fruit"
          onValueChange={onValueChange}
        />
        <button type="submit">Save</button>
      </form>
    );
  }

  it("submits the selected value under its name", async () => {
    const onSubmit = vi.fn();
    render(<FormFixture onSubmit={onSubmit} />);

    await openByClick();
    press(option("Cherry"));
    await waitFor(() => expect(shownListbox()).toBeNull());

    fireEvent.submit(screen.getByTestId("form"));
    expect(submitted(onSubmit)).toBe("cherry");
  });

  it("submits the initial value before the list has opened", () => {
    const onSubmit = vi.fn();
    render(<FormFixture onSubmit={onSubmit} />);

    fireEvent.submit(screen.getByTestId("form"));
    expect(submitted(onSubmit)).toBe("banana");
  });

  it("does not submit the form when Enter opens the list from the trigger", async () => {
    const onSubmit = vi.fn();
    render(<FormFixture onSubmit={onSubmit} />);

    act(() => trigger().focus());
    activateWithKey(trigger(), "Enter");
    await waitFor(() => expect(shownListbox()).not.toBeNull());
    // Trap 1: jsdom emulates no implicit submit, so a library that submits
    // implicitly has to call requestSubmit; it is spied through onSubmit.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit the form when Enter chooses an item", async () => {
    const onSubmit = vi.fn();
    const onValueChange = vi.fn();
    render(<FormFixture onSubmit={onSubmit} onValueChange={onValueChange} />);

    await openByKey("ArrowDown");
    key(active(), "End");
    key(active(), "Enter");

    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("negative control: the submit spy fails when the form does submit", () => {
    const onSubmit = vi.fn();
    render(<FormFixture onSubmit={onSubmit} />);

    (screen.getByTestId("form") as HTMLFormElement).requestSubmit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("Select in other layers", () => {
  it("works inside a dialog without closing it", async () => {
    const onValueChange = vi.fn();
    render(
      <Dialog open>
        <DialogPopup aria-label="Edit" showCloseButton={false}>
          <Fruit onValueChange={onValueChange} />
        </DialogPopup>
      </Dialog>,
    );

    await openByClick();
    press(option("Banana"));

    expect(onValueChange.mock.calls[0]?.[0]).toBe("banana");
    await waitFor(() => expect(shownListbox()).toBeNull());
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument();
    expect(trigger()).toHaveTextContent("Banana");
  });

  it("works inside a popover without closing it", async () => {
    const onValueChange = vi.fn();
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverPopup>
          <PopoverTitle className="sr-only">Filters</PopoverTitle>
          <Fruit onValueChange={onValueChange} />
        </PopoverPopup>
      </Popover>,
    );

    await openByClick();
    press(option("Cherry"));

    expect(onValueChange.mock.calls[0]?.[0]).toBe("cherry");
    await waitFor(() => expect(shownListbox()).toBeNull());
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  });
});

describe("Select parts and options", () => {
  it("renders groups, group labels and separators", async () => {
    render(
      <Select defaultValue="apple">
        <SelectTrigger aria-label="Fruit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectGroupLabel>Sweet</SelectGroupLabel>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectGroupLabel>Tart</SelectGroupLabel>
            <SelectItem value="lemon">Lemon</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    await openByClick();

    expect(screen.getByText("Sweet")).toBeInTheDocument();
    expect(screen.getByText("Tart")).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(
      document.querySelector('[data-slot="select-separator"]'),
    ).not.toBeNull();
  });

  it("applies the wrapper slots to the trigger, popup and items", async () => {
    render(<Fruit defaultValue="apple" />);

    expect(trigger()).toHaveAttribute("data-slot", "select-trigger");
    await openByClick();
    expect(document.querySelector(`[data-slot="${SLOT}"]`)).not.toBeNull();
    expect(option("Apple")).toHaveAttribute("data-slot", "select-item");
  });

  it("renders SelectButton as a plain button that is not a combobox", () => {
    render(<SelectButton size="sm">Pick an icon</SelectButton>);

    const button = screen.getByRole("button", { name: "Pick an icon" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-slot", "select-button");
  });

  it("renders SelectButton with a render prop and no default type", () => {
    render(<SelectButton render={<a href="/x" />}>Go</SelectButton>);

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Go");
    expect(link.hasAttribute("type")).toBe(false);
  });

  it("accepts alignItemWithTrigger on the popup, on by default", async () => {
    render(<Fruit alignItemWithTrigger={false} defaultValue="apple" />);

    await openByClick();
    expect(shownListbox()).not.toBeNull();
  });
});

// Section 11: a select sits inside rows, cards and forms, so a press in its
// content must not reach the component around it.
// Base UI popups never contain events (record section 11), and Base UI's
// select popup stops some keydowns itself, so this runs on the ported wrapper.
describe("Select event containment", () => {
  it("contains pointer and command events from its content", async () => {
    await expectPopupContainment({
      render: ({ containEvents, contentProps, control }) => (
        <Fruit
          containEvents={containEvents}
          contentProps={contentProps}
          control={control}
        />
      ),
      open: async () => {
        press(trigger());
        await waitFor(() => expect(shownListbox()).not.toBeNull());
      },
      content: () => {
        const content = document.querySelector(`[data-slot="${SLOT}"]`);
        if (!content) throw new Error("no select content");
        return content;
      },
    });
  });
});
