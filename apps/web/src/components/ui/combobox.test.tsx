/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The ancestor div stands in for a clickable card around a popup; it is a
   probe, not interactive UI. */
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
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSeparator,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
} from "./combobox";
import { expectPopupContainment } from "./popup-containment-test-utils";

afterEach(cleanup);

const FRUITS = ["Apple", "Apricot", "Banana", "Cherry"];

type User = { id: string; name: string };
const USERS: User[] = [
  { id: "u1", name: "Ada Lovelace" },
  { id: "u2", name: "Alan Turing" },
  { id: "u3", name: "Grace Hopper" },
];

function options() {
  return screen.queryAllByRole("option");
}

function optionNames() {
  return options().map((option) => option.textContent?.trim());
}

// Typing opens the list in the browser. jsdom's change event does not reach
// Base UI's open-on-type path, so a closed list is opened with ArrowDown, the
// documented key. Callers that care about the highlight call `highlightFirst`.
async function type(input: HTMLElement, value: string) {
  input.focus();
  fireEvent.change(input, { target: { value } });
  await act(async () => {});
  if (value !== "" && options().length === 0) {
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await act(async () => {});
  }
}

function activeOption(input: HTMLElement) {
  const id = input.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
}

async function highlightFirst(input: HTMLElement) {
  for (let attempt = 0; attempt < 2 && !activeOption(input); attempt += 1) {
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await act(async () => {});
  }
  return activeOption(input);
}

async function openByTrigger() {
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
  await waitFor(() => expect(options().length).toBeGreaterThan(0));
}

function FruitCombobox(
  props: Partial<React.ComponentProps<typeof Combobox<string>>> & {
    disabledFruit?: string;
    showClear?: boolean;
  },
) {
  const { disabledFruit, showClear, ...rest } = props;
  return (
    <Combobox items={FRUITS} {...rest}>
      <ComboboxInput
        aria-label="Fruit"
        showClear={showClear}
        showTrigger={false}
      />
      <ComboboxTrigger aria-label="Show">v</ComboboxTrigger>
      <ComboboxPopup>
        <ComboboxEmpty>No fruit found</ComboboxEmpty>
        <ComboboxList>
          {(fruit: string) => (
            <ComboboxItem
              disabled={fruit === disabledFruit}
              key={fruit}
              value={fruit}
            >
              {fruit}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}

// jsdom does not run the browser's default action for Enter. This does it
// when the keydown was not prevented: a button is clicked, a text input
// submits its form. Without it these tests could not fail (trap 5).
function pressEnter(element: HTMLElement) {
  const notPrevented = fireEvent.keyDown(element, { key: "Enter" });
  if (notPrevented) {
    if (element instanceof HTMLButtonElement) {
      fireEvent.click(element);
    } else if (element instanceof HTMLInputElement) {
      const form = element.form;
      const submit = form?.querySelector<HTMLButtonElement>(
        "button[type=submit]",
      );
      if (form && submit) fireEvent.click(submit);
    }
  }
  return notPrevented;
}

function FormProbe(props: { onSubmit: () => void; name?: string }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <Combobox items={FRUITS} name={props.name}>
        <ComboboxInput aria-label="Fruit" showTrigger={false} />
        <ComboboxTrigger aria-label="Show">v</ComboboxTrigger>
        <ComboboxPopup>
          <ComboboxList>
            {(fruit: string) => (
              <ComboboxItem key={fruit} value={fruit}>
                {fruit}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
      <button type="submit">Save</button>
    </form>
  );
}

describe("Combobox parity", () => {
  it("filters the list as the user types and shows the empty state", async () => {
    render(<FruitCombobox />);
    const input = screen.getByRole("combobox", { name: "Fruit" });

    await type(input, "ap");
    await waitFor(() => expect(optionNames()).toEqual(["Apple", "Apricot"]));

    await type(input, "zzz");
    await waitFor(() => expect(options()).toHaveLength(0));
    expect(screen.getByText("No fruit found")).toBeVisible();

    await type(input, "");
    await waitFor(() => expect(optionNames()).toEqual(FRUITS));
    expect(screen.queryByText("No fruit found")).toBeNull();
  });

  it("picks the highlighted option with the keyboard and reports the value", async () => {
    const onValueChange = vi.fn();
    render(<FruitCombobox onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox", { name: "Fruit" });

    await type(input, "ban");
    await waitFor(() => expect(optionNames()).toEqual(["Banana"]));
    expect((await highlightFirst(input))?.textContent).toBe("Banana");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("Banana");
    expect(input).toHaveValue("Banana");
    await waitFor(() => expect(options()).toHaveLength(0));
  });

  it("picks an option by click", async () => {
    const onValueChange = vi.fn();
    render(<FruitCombobox onValueChange={onValueChange} />);
    await openByTrigger();

    fireEvent.click(screen.getByRole("option", { name: "Cherry" }));
    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("Cherry");
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveValue(
      "Cherry",
    );
  });

  it("opens from the trigger and closes on Escape, keeping focus in the input", async () => {
    render(<FruitCombobox />);
    const input = screen.getByRole("combobox", { name: "Fruit" });
    input.focus();
    await openByTrigger();
    expect(options().length).toBe(FRUITS.length);

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(options()).toHaveLength(0));
    expect(input).toHaveFocus();
  });

  it("clears the value and the text with the clear button", async () => {
    const onValueChange = vi.fn();
    render(
      <FruitCombobox
        defaultValue="Apple"
        onValueChange={onValueChange}
        showClear
      />,
    );
    const input = screen.getByRole("combobox", { name: "Fruit" });
    expect(input).toHaveValue("Apple");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(input).toHaveValue(""));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBeNull();
  });

  it("maps object values with itemToLabel, itemToValue and isItemEqualToValue", async () => {
    const onValueChange = vi.fn();
    // A different object with the same id: only isItemEqualToValue can match it.
    const selected: User = { id: "u2", name: "Alan Turing" };
    render(
      <Combobox
        isItemEqualToValue={(item, value) => item.id === value.id}
        itemToLabel={(user: User) => user.name}
        itemToValue={(user: User) => user.id}
        items={USERS}
        name="user"
        onValueChange={onValueChange}
        value={selected}
      >
        <ComboboxInput aria-label="User" showTrigger={false} />
        <ComboboxTrigger aria-label="Show">v</ComboboxTrigger>
        <ComboboxPopup>
          <ComboboxList>
            {(user: User) => (
              <ComboboxItem key={user.id} value={user}>
                {user.name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>,
    );
    const input = screen.getByRole("combobox", { name: "User" });
    expect(input).toHaveValue("Alan Turing");

    await openByTrigger();
    expect(screen.getByRole("option", { name: "Alan Turing" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("option", { name: "Ada Lovelace" }),
    ).toHaveAttribute("aria-selected", "false");

    const hidden =
      document.querySelector<HTMLInputElement>('input[name="user"]');
    expect(hidden?.value).toBe("u2");

    fireEvent.click(screen.getByRole("option", { name: "Grace Hopper" }));
    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1));
    expect(onValueChange.mock.calls[0]?.[0]).toEqual(USERS[2]);
  });

  it("keeps every item with filter={null} and reports typing through onQueryChange", async () => {
    const onQueryChange = vi.fn();
    render(
      <Combobox filter={null} items={FRUITS} onQueryChange={onQueryChange}>
        <ComboboxInput aria-label="Fruit" showTrigger={false} />
        <ComboboxPopup>
          <ComboboxList>
            {(fruit: string) => (
              <ComboboxItem key={fruit} value={fruit}>
                {fruit}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>,
    );
    const input = screen.getByRole("combobox", { name: "Fruit" });
    await type(input, "zz");

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());
    expect(onQueryChange.mock.calls.at(-1)?.[0]).toBe("zz");
    await waitFor(() => expect(optionNames()).toEqual(FRUITS));
  });

  it("renders groups, a separator and a status line", async () => {
    render(
      <Combobox>
        <ComboboxInput aria-label="Fruit" showTrigger={false} />
        <ComboboxTrigger aria-label="Show">v</ComboboxTrigger>
        <ComboboxPopup>
          <ComboboxStatus>Searching…</ComboboxStatus>
          <ComboboxList>
            <ComboboxGroup>
              <ComboboxGroupLabel>Citrus</ComboboxGroupLabel>
              <ComboboxItem value="lemon">Lemon</ComboboxItem>
            </ComboboxGroup>
            <ComboboxSeparator />
            <ComboboxGroup>
              <ComboboxGroupLabel>Stone</ComboboxGroupLabel>
              <ComboboxItem value="plum">Plum</ComboboxItem>
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>,
    );
    await openByTrigger();

    expect(screen.getByText(/Searching/)).toBeVisible();
    expect(screen.getByRole("group", { name: "Citrus" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Stone" })).toBeVisible();
    expect(optionNames()).toEqual(["Lemon", "Plum"]);
  });

  describe("multiple with chips", () => {
    function ChipsCombobox(props: {
      onValueChange?: (value: string[]) => void;
      defaultValue?: string[];
    }) {
      return (
        <Combobox items={FRUITS} multiple {...props}>
          <ComboboxChips>
            <ComboboxValue>
              {(values: string[]) => (
                <>
                  {values.map((fruit) => (
                    <ComboboxChip key={fruit} value={fruit}>
                      {fruit}
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput aria-label="Fruits" />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxPopup>
            <ComboboxEmpty>No fruit found</ComboboxEmpty>
            <ComboboxList>
              {(fruit: string) => (
                <ComboboxItem key={fruit} value={fruit}>
                  {fruit}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>
      );
    }

    it("adds a chip per pick, keeps the list open, and removes a chip", async () => {
      const onValueChange = vi.fn();
      render(<ChipsCombobox onValueChange={onValueChange} />);
      const input = screen.getByRole("combobox", { name: "Fruits" });
      await type(input, "a");
      await waitFor(() => expect(options().length).toBeGreaterThan(0));

      fireEvent.click(screen.getByRole("option", { name: "Apple" }));
      await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1));
      expect(onValueChange.mock.calls[0]?.[0]).toEqual(["Apple"]);
      expect(
        document.querySelector("[data-slot=combobox-chip]"),
      ).toHaveTextContent("Apple");

      fireEvent.click(screen.getByRole("option", { name: "Banana" }));
      await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(2));
      expect(onValueChange.mock.calls[1]?.[0]).toEqual(["Apple", "Banana"]);
      expect(
        document.querySelectorAll("[data-slot=combobox-chip]"),
      ).toHaveLength(2);

      const removes = screen.getAllByRole("button", { name: "Remove" });
      expect(removes).toHaveLength(2);
      fireEvent.click(removes[0] as HTMLElement);
      await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(3));
      expect(onValueChange.mock.calls[2]?.[0]).toEqual(["Banana"]);
      expect(
        document.querySelectorAll("[data-slot=combobox-chip]"),
      ).toHaveLength(1);
    });

    it("removes the last chip with Backspace in an empty input", async () => {
      const onValueChange = vi.fn();
      render(
        <ChipsCombobox
          defaultValue={["Apple", "Banana"]}
          onValueChange={onValueChange}
        />,
      );
      const input = screen.getByRole("combobox", { name: "Fruits" });
      input.focus();
      fireEvent.keyDown(input, { key: "Backspace" });

      await waitFor(() => expect(onValueChange).toHaveBeenCalled());
      expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(["Apple"]);
    });
  });

  describe("disabled", () => {
    it("a disabled combobox cannot be focused or opened", async () => {
      render(<FruitCombobox disabled />);
      const input = screen.getByRole("combobox", { name: "Fruit" });
      expect(input).toBeDisabled();
      const trigger = screen.getByRole("button", { name: "Show" });
      fireEvent.click(trigger);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(options()).toHaveLength(0);
      input.focus();
      expect(input).not.toHaveFocus();
    });

    it("a disabled item is skipped by the arrows and cannot be picked", async () => {
      const onValueChange = vi.fn();
      render(
        <FruitCombobox disabledFruit="Banana" onValueChange={onValueChange} />,
      );
      const input = screen.getByRole("combobox", { name: "Fruit" });
      input.focus();
      await openByTrigger();

      const banana = screen.getByRole("option", { name: "Banana" });
      // Native-disabled parity: the item is marked, not selectable.
      expect(
        banana.hasAttribute("data-disabled") ||
          banana.getAttribute("aria-disabled") === "true",
      ).toBe(true);

      fireEvent.click(banana);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(onValueChange).not.toHaveBeenCalled();

      // Arrow through the list and press Enter on each stop. Whether the
      // highlight reaches a disabled item or skips it, Enter must never pick it.
      const highlighted: string[] = [];
      for (let step = 0; step < 5; step += 1) {
        fireEvent.keyDown(input, { key: "ArrowDown" });
        await act(async () => {});
        const active = activeOption(input)?.textContent?.trim() ?? "";
        highlighted.push(active);
        if (active === "Banana") {
          fireEvent.keyDown(input, { key: "Enter" });
          await act(async () => {});
        }
      }
      // Negative control: the enabled items are reachable.
      expect(highlighted).toContain("Apple");
      expect(highlighted).toContain("Cherry");
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe("inside a form", () => {
    it("negative control: Enter in a closed, empty input submits the form", async () => {
      const onSubmit = vi.fn();
      render(<FormProbe onSubmit={onSubmit} />);
      const input = screen.getByRole("combobox", { name: "Fruit" });
      input.focus();
      pressEnter(input);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("Enter on a highlighted option picks it and does not submit", async () => {
      const onSubmit = vi.fn();
      render(<FormProbe onSubmit={onSubmit} />);
      const input = screen.getByRole("combobox", { name: "Fruit" });
      await type(input, "che");
      await waitFor(() => expect(optionNames()).toEqual(["Cherry"]));
      expect((await highlightFirst(input))?.textContent).toBe("Cherry");
      const notPrevented = pressEnter(input);
      await waitFor(() => expect(input).toHaveValue("Cherry"));
      expect(notPrevented).toBe(false);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("Enter on the trigger does not submit the form", async () => {
      const onSubmit = vi.fn();
      render(<FormProbe onSubmit={onSubmit} />);
      const trigger = screen.getByRole("button", { name: "Show" });
      trigger.focus();
      pressEnter(trigger);
      await act(async () => {});
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("Enter on an option element does not submit the form", async () => {
      const onSubmit = vi.fn();
      render(<FormProbe onSubmit={onSubmit} />);
      await openByTrigger();
      pressEnter(screen.getByRole("option", { name: "Apple" }));
      await act(async () => {});
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("submits the chosen value under its name", async () => {
      render(<FormProbe name="fruit" onSubmit={() => {}} />);
      const input = screen.getByRole("combobox", { name: "Fruit" });
      await type(input, "ban");
      await waitFor(() => expect(optionNames()).toEqual(["Banana"]));
      fireEvent.click(screen.getByRole("option", { name: "Banana" }));
      await waitFor(() => expect(input).toHaveValue("Banana"));
      const form = document.querySelector("form") as HTMLFormElement;
      expect(new FormData(form).get("fruit")).toBe("Banana");
    });
  });

  it("keeps the Base UI function filter signature (item, query, itemToString)", async () => {
    // Without itemToLabel Base UI hands no conversion, so it is not called.
    const seen: [string, string][] = [];
    render(
      <FruitCombobox
        filter={(fruit: string, query: string) => {
          seen.push([fruit, query]);
          return fruit.toLowerCase().startsWith(query.toLowerCase());
        }}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Fruit" });
    await type(input, "ap");

    // startsWith, not contains: Grape holds "ap" and must stay out.
    await waitFor(() => expect(optionNames()).toEqual(["Apple", "Apricot"]));
    expect(seen.length).toBeGreaterThan(0);
    // The filter got the raw item, the query, and a string conversion.
    expect(seen.every(([fruit]) => FRUITS.includes(fruit))).toBe(true);
    expect(seen.some(([, query]) => query === "ap")).toBe(true);
  });

  it("passes raw object items and the label function to a function filter", async () => {
    render(
      <Combobox
        filter={(
          user: User,
          query: string,
          itemToString: (value: User) => string,
        ) => itemToString(user).toLowerCase().startsWith(query.toLowerCase())}
        itemToLabel={(user: User) => user.name}
        items={USERS}
      >
        <ComboboxInput aria-label="User" showTrigger={false} />
        <ComboboxPopup>
          <ComboboxList>
            {(user: User) => (
              <ComboboxItem key={user.id} value={user}>
                {user.name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>,
    );
    await type(screen.getByRole("combobox", { name: "User" }), "al");
    await waitFor(() => expect(optionNames()).toEqual(["Alan Turing"]));
  });

  it("closes on an outside press", async () => {
    render(<FruitCombobox />);
    await openByTrigger();
    fireEvent.pointerDown(document.body, { pointerType: "mouse" });
    fireEvent.mouseDown(document.body);
    fireEvent.pointerUp(document.body, { pointerType: "mouse" });
    fireEvent.mouseUp(document.body);
    fireEvent.click(document.body);
    await waitFor(() => expect(options()).toHaveLength(0));
  });

  it("reports open and close through onOpenChange with a boolean first argument", async () => {
    const onOpenChange = vi.fn();
    render(<FruitCombobox onOpenChange={onOpenChange} />);
    const input = screen.getByRole("combobox", { name: "Fruit" });
    input.focus();
    await openByTrigger();
    expect(onOpenChange.mock.calls.map((call) => call[0])).toEqual([true]);

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(options()).toHaveLength(0));
    expect(onOpenChange.mock.calls.map((call) => call[0])).toEqual([
      true,
      false,
    ]);

    await openByTrigger();
    fireEvent.click(screen.getByRole("option", { name: "Cherry" }));
    await waitFor(() => expect(options()).toHaveLength(0));
    expect(onOpenChange.mock.calls.map((call) => call[0])).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(
      onOpenChange.mock.calls.every((call) => typeof call[0] === "boolean"),
    ).toBe(true);
  });

  describe("Space", () => {
    it("types a space in the input and neither picks nor closes the list", async () => {
      const onValueChange = vi.fn();
      render(<FruitCombobox onValueChange={onValueChange} />);
      const input = screen.getByRole("combobox", { name: "Fruit" });
      await type(input, "ap");
      expect((await highlightFirst(input))?.textContent).toBe("Apple");

      const notPrevented = fireEvent.keyDown(input, { key: " " });
      await act(async () => {});
      expect(notPrevented).toBe(true);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(options().length).toBeGreaterThan(0);
    });

    it("on the trigger opens the list", async () => {
      render(<FruitCombobox />);
      const trigger = screen.getByRole("button", { name: "Show" });
      trigger.focus();
      // A native button activates on Space keyup unless keydown was prevented;
      // jsdom does not do that (trap 5), so do it when the page would.
      const downNotPrevented = fireEvent.keyDown(trigger, { key: " " });
      const upNotPrevented = fireEvent.keyUp(trigger, { key: " " });
      if (downNotPrevented && upNotPrevented) fireEvent.click(trigger);
      await waitFor(() => expect(options().length).toBeGreaterThan(0));
    });
  });

  it("contains popup events", async () => {
    await expectPopupContainment({
      render: ({ containEvents, contentProps, control }) => (
        <Combobox items={FRUITS}>
          <ComboboxInput aria-label="Fruit" showTrigger={false} />
          <ComboboxTrigger aria-label="Show">v</ComboboxTrigger>
          <ComboboxPopup containEvents={containEvents} {...contentProps}>
            {control}
            <ComboboxList>
              {(fruit: string) => (
                <ComboboxItem key={fruit} value={fruit}>
                  {fruit}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>
      ),
      open: openByTrigger,
      content: () => {
        const content = document.querySelector("[data-slot=combobox-content]");
        if (!content) throw new Error("no combobox content");
        return content;
      },
    });
  });
});

// Behavior UI SDK adds or changes on purpose. Not parity: Base UI does not pass.
describe("Combobox added behavior", () => {
  it("Enter in an open list with nothing highlighted is handled by the list", async () => {
    const onSubmit = vi.fn();
    render(<FormProbe onSubmit={onSubmit} />);
    const input = screen.getByRole("combobox", { name: "Fruit" });
    input.focus();
    await openByTrigger();
    expect(activeOption(input)).toBeNull();
    const notPrevented = pressEnter(input);
    await act(async () => {});
    // Accepted by the coordinator (A3). Base UI left Enter alone here, so the
    // browser submitted the form (notPrevented true, onSubmit once). UI SDK
    // handles Enter while the list is open and prevents it: no submit. The
    // closed-list control in the parity block proves the probe sees a submit.
    expect(notPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // Base UI never reset the combobox on form.reset(): the chosen value and text
  // stayed. UI SDK restores the default (or clears), so this is added behavior.
  describe("form reset", () => {
    function ResetProbe(props: { defaultValue?: string }) {
      return (
        <form>
          <Combobox
            defaultValue={props.defaultValue}
            items={FRUITS}
            name="fruit"
          >
            <ComboboxInput aria-label="Fruit" showTrigger={false} />
            <ComboboxTrigger aria-label="Show">v</ComboboxTrigger>
            <ComboboxPopup>
              <ComboboxList>
                {(fruit: string) => (
                  <ComboboxItem key={fruit} value={fruit}>
                    {fruit}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxPopup>
          </Combobox>
        </form>
      );
    }

    it("clears the chosen value and the text", async () => {
      render(<ResetProbe />);
      const input = screen.getByRole("combobox", { name: "Fruit" });
      const form = document.querySelector("form") as HTMLFormElement;
      await openByTrigger();
      fireEvent.click(screen.getByRole("option", { name: "Banana" }));
      await waitFor(() => expect(input).toHaveValue("Banana"));
      expect(new FormData(form).get("fruit")).toBe("Banana");

      act(() => form.reset());
      await waitFor(() => expect(input).toHaveValue(""));
      expect(new FormData(form).get("fruit") ?? "").toBe("");
    });

    it("returns to the default value", async () => {
      render(<ResetProbe defaultValue="Apple" />);
      const input = screen.getByRole("combobox", { name: "Fruit" });
      const form = document.querySelector("form") as HTMLFormElement;
      expect(input).toHaveValue("Apple");
      await openByTrigger();
      fireEvent.click(screen.getByRole("option", { name: "Banana" }));
      await waitFor(() => expect(input).toHaveValue("Banana"));

      act(() => form.reset());
      await waitFor(() => expect(input).toHaveValue("Apple"));
      expect(new FormData(form).get("fruit")).toBe("Apple");
    });
  });
});
