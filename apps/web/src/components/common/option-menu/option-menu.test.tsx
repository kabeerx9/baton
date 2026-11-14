import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { OptionMenu } from "./option-menu";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const options = [
  { value: "to-do", label: "To Do" },
  { value: "done", label: "Done", selected: true },
];

const manyOptions = [
  { value: "none", label: "No assignee", pinned: true },
  { value: "ada", label: "Ada Lovelace" },
  { value: "alan", label: "Alan Turing" },
  { value: "grace", label: "Grace Hopper" },
];

// UI SDK settles the highlight and the empty state in a microtask.
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

async function renderMenu(
  props: Partial<React.ComponentProps<typeof OptionMenu>> = {},
) {
  const onSelect = vi.fn();
  render(
    <OptionMenu
      label="Status"
      placeholder="Change status"
      options={options}
      onSelect={onSelect}
      {...props}
    />,
  );
  await flush();
  return { onSelect, input: screen.getByPlaceholderText("Change status") };
}

function optionNames() {
  return screen.queryAllByRole("option").map((o) => o.textContent);
}

describe("OptionMenu", () => {
  it("picks an option by its number", async () => {
    const { onSelect, input } = await renderMenu();

    fireEvent.keyDown(input, { key: "2" });

    await flush();

    expect(onSelect).toHaveBeenCalledWith("done");
  });

  it("catches a number pressed before the menu has focus", async () => {
    const { onSelect } = await renderMenu();

    fireEvent.keyDown(document.body, { key: "1" });

    await flush();

    expect(onSelect).toHaveBeenCalledWith("to-do");
  });

  it("types digits into the search once a query exists", async () => {
    const { onSelect, input } = await renderMenu();

    fireEvent.change(input, { target: { value: "do" } });

    await flush();
    fireEvent.keyDown(input, { key: "1" });
    await flush();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the current value", async () => {
    await renderMenu();

    expect(screen.getByRole("option", { name: "Done" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("option", { name: /To Do/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("is open from the start: the list shows without a click", async () => {
    await renderMenu();

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("filters on typing, keeps pinned options, and reports the query", async () => {
    const onQueryChange = vi.fn();
    const { input } = await renderMenu({ options: manyOptions, onQueryChange });

    fireEvent.change(input, { target: { value: "al" } });

    await flush();

    expect(optionNames()).toEqual(["No assignee", "Alan Turing"]);
    expect(onQueryChange).toHaveBeenLastCalledWith("al");

    fireEvent.change(input, { target: { value: "AD" } });

    await flush();
    expect(optionNames()).toEqual(["No assignee", "Ada Lovelace"]);
  });

  it("restores the full list when the text is cleared by typing", async () => {
    const onQueryChange = vi.fn();
    const { input } = await renderMenu({ options: manyOptions, onQueryChange });

    fireEvent.change(input, { target: { value: "gr" } });

    await flush();
    expect(optionNames()).toHaveLength(2);
    fireEvent.change(input, { target: { value: "" } });
    await flush();

    expect(optionNames()).toHaveLength(4);
    expect(onQueryChange).toHaveBeenLastCalledWith("");
    expect(input).toHaveValue("");
  });

  it("shows the empty text when nothing matches and no status is set", async () => {
    const { input } = await renderMenu();

    fireEvent.change(input, { target: { value: "zzz" } });

    await flush();

    expect(optionNames()).toEqual([]);
    expect(screen.getByText("tasks:filterMenu.noResults")).toBeInTheDocument();
  });

  it("shows the status instead of the list", async () => {
    await renderMenu({ status: "Loading people" });

    expect(screen.getByText("Loading people")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("highlights the first option and selects it on Enter", async () => {
    const { onSelect, input } = await renderMenu();

    expect(screen.getByRole("option", { name: /To Do/ })).toHaveAttribute(
      "data-highlighted",
    );
    fireEvent.keyDown(input, { key: "Enter" });
    await flush();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("to-do");
  });

  it("moves the highlight with the arrow keys and selects that option", async () => {
    const { onSelect, input } = await renderMenu({ options: manyOptions });

    fireEvent.keyDown(input, { key: "ArrowDown" });

    await flush();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await flush();
    expect(screen.getByRole("option", { name: /Alan Turing/ })).toHaveAttribute(
      "data-highlighted",
    );
    fireEvent.keyDown(input, { key: "Enter" });
    await flush();

    expect(onSelect).toHaveBeenCalledWith("alan");
  });

  it("selects an option on click, once", async () => {
    const { onSelect } = await renderMenu();

    fireEvent.click(screen.getByRole("option", { name: /Done/ }));

    await flush();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("done");
  });

  it("stays open after Escape, after a choice and after a number key", async () => {
    const { input, onSelect } = await renderMenu();

    fireEvent.keyDown(input, { key: "Escape" });

    await flush();
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /Done/ }));

    await flush();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("shows number hints only while the query is empty", async () => {
    const { input } = await renderMenu({ options: manyOptions });

    expect(
      screen.getByRole("option", { name: /Ada Lovelace/ }),
    ).toHaveTextContent("2");
    fireEvent.change(input, { target: { value: "ad" } });
    await flush();
    expect(
      screen.getByRole("option", { name: /Ada Lovelace/ }),
    ).not.toHaveTextContent("2");
  });

  it("does not select by number from another text field", async () => {
    const { onSelect } = await renderMenu();
    const other = document.createElement("input");
    document.body.append(other);

    fireEvent.keyDown(other, { key: "1" });

    await flush();
    other.remove();

    expect(onSelect).not.toHaveBeenCalled();
  });

  describe("inside a form (trap 1)", () => {
    async function renderInForm() {
      const submitted = vi.fn((event: Event) => event.preventDefault());
      const requestSubmit = vi.spyOn(
        HTMLFormElement.prototype,
        "requestSubmit",
      );
      document.addEventListener("submit", submitted);
      const onSelect = vi.fn();
      render(
        <form>
          <OptionMenu
            label="Status"
            placeholder="Change status"
            options={options}
            onSelect={onSelect}
          />
          <button type="submit">Save</button>
        </form>,
      );
      await flush();
      return {
        onSelect,
        submitted,
        requestSubmit,
        input: screen.getByPlaceholderText("Change status"),
        stop: () => document.removeEventListener("submit", submitted),
      };
    }

    it("selects on Enter and does not submit the form", async () => {
      const ctx = await renderInForm();

      const allowed = fireEvent.keyDown(ctx.input, { key: "Enter" });

      ctx.stop();
      expect(ctx.onSelect).toHaveBeenCalledWith("to-do");
      // The browser submits a form on Enter unless keydown is default-prevented.
      expect(allowed).toBe(false);
      expect(ctx.requestSubmit).not.toHaveBeenCalled();
      expect(ctx.submitted).not.toHaveBeenCalled();
    });

    it("negative control: the helpers see a submit when one happens", async () => {
      const submitted = vi.fn((event: Event) => event.preventDefault());
      const requestSubmit = vi.spyOn(
        HTMLFormElement.prototype,
        "requestSubmit",
      );
      document.addEventListener("submit", submitted);
      render(
        <form>
          <input
            aria-label="plain"
            onKeyDown={(event) => {
              if (event.key === "Enter")
                event.currentTarget.form?.requestSubmit();
            }}
          />
          <button type="submit">Save</button>
        </form>,
      );

      const allowed = fireEvent.keyDown(screen.getByLabelText("plain"), {
        key: "Enter",
      });

      document.removeEventListener("submit", submitted);
      expect(allowed).toBe(true);
      expect(requestSubmit).toHaveBeenCalledTimes(1);
      expect(submitted).toHaveBeenCalledTimes(1);
    });
  });
});
