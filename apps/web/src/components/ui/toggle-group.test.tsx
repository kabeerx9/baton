import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  ToggleGroupSeparator,
} from "./toggle-group";

function GroupItems() {
  return (
    <>
      <ToggleGroupItem value="board">Board</ToggleGroupItem>
      <ToggleGroupItem value="list">List</ToggleGroupItem>
    </>
  );
}

describe("ToggleGroup parity (passes on the Base UI wrapper)", () => {
  it("renders a group with its items as toggle buttons", () => {
    render(
      <ToggleGroup aria-label="View" size="sm" value={["board"]}>
        <GroupItems />
      </ToggleGroup>,
    );

    const group = screen.getByRole("group", { name: "View" });
    expect(group).toHaveAttribute("data-slot", "toggle-group");
    expect(group).toHaveAttribute("data-orientation", "horizontal");
    // From the wrapper's variant props.
    expect(group).toHaveAttribute("data-size", "sm");
    expect(group).toHaveAttribute("data-variant", "default");

    const items = screen.getAllByRole("button");
    expect(items.map((item) => item.textContent)).toEqual(["Board", "List"]);
    for (const item of items) {
      expect(item).toHaveAttribute("data-slot", "toggle");
      expect(item).toHaveAttribute("type", "button");
      // The wrapper passes the group's size and variant down to each item.
      expect(item).toHaveAttribute("data-size", "sm");
    }
    expect(items[0]).toHaveAttribute("aria-pressed", "true");
    expect(items[0]).toHaveAttribute("data-pressed");
    expect(items[1]).toHaveAttribute("aria-pressed", "false");
    expect(items[1]).not.toHaveAttribute("data-pressed");
  });

  it("replaces the pressed item in single mode and reports an array", () => {
    const onValueChange = vi.fn();
    render(
      <ToggleGroup aria-label="View" onValueChange={onValueChange} value={[]}>
        <GroupItems />
      </ToggleGroup>,
    );
    const [board, list] = screen.getAllByRole("button");

    fireEvent.click(board);
    expect(onValueChange).toHaveBeenLastCalledWith(
      ["board"],
      expect.anything(),
    );
    expect(Array.isArray(onValueChange.mock.calls[0][0])).toBe(true);
    expect(typeof onValueChange.mock.calls[0][0][0]).toBe("string");

    fireEvent.click(list);
    expect(onValueChange).toHaveBeenLastCalledWith(["list"], expect.anything());
  });

  it("clears the value when the pressed item is pressed again", () => {
    const onValueChange = vi.fn();
    render(
      <ToggleGroup
        aria-label="View"
        onValueChange={onValueChange}
        value={["board"]}
      >
        <GroupItems />
      </ToggleGroup>,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onValueChange).toHaveBeenLastCalledWith([], expect.anything());
  });

  it("adds and removes pressed items in multiple mode", () => {
    const onValueChange = vi.fn();
    render(
      <ToggleGroup
        aria-label="Formatting"
        defaultValue={["board"]}
        multiple
        onValueChange={onValueChange}
      >
        <GroupItems />
      </ToggleGroup>,
    );
    const [board, list] = screen.getAllByRole("button");
    expect(board).toHaveAttribute("data-pressed");

    fireEvent.click(list);
    expect(onValueChange).toHaveBeenLastCalledWith(
      ["board", "list"],
      expect.anything(),
    );
    expect(list).toHaveAttribute("data-pressed");
    expect(board).toHaveAttribute("data-pressed");

    fireEvent.click(board);
    expect(onValueChange).toHaveBeenLastCalledWith(["list"], expect.anything());
  });

  it("natively disables every item when the group is disabled", () => {
    const onValueChange = vi.fn();
    render(
      <ToggleGroup
        aria-label="View"
        disabled
        onValueChange={onValueChange}
        value={[]}
      >
        <GroupItems />
      </ToggleGroup>,
    );

    expect(screen.getByRole("group")).toHaveAttribute("data-disabled");
    for (const item of screen.getAllByRole("button")) {
      expect(item).toBeDisabled();
      expect(item).toHaveAttribute("data-disabled");
      // aria-disabled stays, as on the Base UI wrapper.
      expect(item).toHaveAttribute("aria-disabled", "true");
      // `disabled:` variants only match a natively disabled button.
      expect(item).toHaveClass(
        "disabled:opacity-64",
        "disabled:pointer-events-none",
      );
    }

    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("natively disables a single item and keeps the group's other items enabled", () => {
    const onValueChange = vi.fn();
    render(
      <ToggleGroup aria-label="View" onValueChange={onValueChange} value={[]}>
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem disabled value="b">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="c">C</ToggleGroupItem>
      </ToggleGroup>,
    );
    const [, b, c] = screen.getAllByRole("button");

    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("data-disabled");
    expect(c).not.toBeDisabled();
    fireEvent.click(b);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("leaves disabled items out of the tab order", () => {
    render(
      <div>
        <button type="button">Before</button>
        <ToggleGroup aria-label="View" disabled value={[]}>
          <GroupItems />
        </ToggleGroup>
        <button type="button">After</button>
      </div>,
    );
    const before = screen.getByRole("button", { name: "Before" });
    const [board] = screen.getAllByRole("button", { name: "Board" });

    // jsdom does not run tab traversal, but it applies the browser rule that
    // makes Tab skip these: a disabled button cannot take focus.
    before.focus();
    expect(before).toHaveFocus();
    board.focus();
    expect(before).toHaveFocus();
    expect(board).not.toHaveFocus();
  });

  it("skips a disabled item with the arrow keys", async () => {
    const onValueChange = vi.fn();
    render(
      <ToggleGroup aria-label="View" onValueChange={onValueChange} value={[]}>
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem disabled value="b">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="c">C</ToggleGroupItem>
      </ToggleGroup>,
    );
    const [a, b, c] = screen.getAllByRole("button");

    a.focus();
    fireEvent.keyDown(a, { key: "ArrowRight" });
    await waitFor(() => expect(c).toHaveFocus());
    expect(b).not.toHaveFocus();
    // The focused item becomes the group's tab stop.
    await waitFor(() => expect(c).toHaveAttribute("tabindex", "0"));

    fireEvent.keyDown(c, { key: "ArrowLeft" });
    await waitFor(() => expect(a).toHaveFocus());

    // Wrapping and Home/End count only the enabled items.
    fireEvent.keyDown(a, { key: "End" });
    await waitFor(() => expect(c).toHaveFocus());
    fireEvent.keyDown(c, { key: "ArrowRight" });
    await waitFor(() => expect(a).toHaveFocus());
    fireEvent.keyDown(a, { key: "ArrowLeft" });
    await waitFor(() => expect(c).toHaveFocus());
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("does not wrap at the ends when loop is false", async () => {
    render(
      <ToggleGroup aria-label="View" loop={false} value={[]}>
        <GroupItems />
      </ToggleGroup>,
    );
    const [board, list] = screen.getAllByRole("button");

    list.focus();
    fireEvent.keyDown(list, { key: "ArrowRight" });
    await waitFor(() => expect(list).toHaveFocus());

    fireEvent.keyDown(list, { key: "ArrowLeft" });
    await waitFor(() => expect(board).toHaveFocus());
    fireEvent.keyDown(board, { key: "ArrowLeft" });
    await waitFor(() => expect(board).toHaveFocus());
  });

  it("keeps loop working when the group has a disabled item", async () => {
    render(
      <ToggleGroup aria-label="View" loop={false} value={[]}>
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem disabled value="b">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="c">C</ToggleGroupItem>
      </ToggleGroup>,
    );
    const [a, , c] = screen.getAllByRole("button");

    c.focus();
    fireEvent.keyDown(c, { key: "ArrowRight" });
    await waitFor(() => expect(c).toHaveFocus());
    fireEvent.keyDown(c, { key: "ArrowLeft" });
    await waitFor(() => expect(a).toHaveFocus());
  });

  it("keeps one tab stop and moves focus with the arrow keys", async () => {
    render(
      <ToggleGroup aria-label="View" value={[]}>
        <GroupItems />
      </ToggleGroup>,
    );
    const [board, list] = screen.getAllByRole("button");

    // One tab stop for the whole group.
    const stops = screen
      .getAllByRole("button")
      .filter((item) => item.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);

    board.focus();
    fireEvent.keyDown(board, { key: "ArrowRight" });
    await waitFor(() => expect(list).toHaveFocus());

    fireEvent.keyDown(list, { key: "ArrowLeft" });
    await waitFor(() => expect(board).toHaveFocus());

    // Focus wraps at the ends.
    fireEvent.keyDown(board, { key: "ArrowLeft" });
    await waitFor(() => expect(list).toHaveFocus());

    fireEvent.keyDown(list, { key: "Home" });
    await waitFor(() => expect(board).toHaveFocus());

    fireEvent.keyDown(board, { key: "End" });
    await waitFor(() => expect(list).toHaveFocus());
  });

  it("moves focus with Up and Down in a vertical group", async () => {
    render(
      <ToggleGroup aria-label="View" orientation="vertical" value={[]}>
        <GroupItems />
      </ToggleGroup>,
    );
    const [board, list] = screen.getAllByRole("button");

    expect(screen.getByRole("group")).toHaveAttribute(
      "data-orientation",
      "vertical",
    );
    board.focus();
    fireEvent.keyDown(board, { key: "ArrowDown" });
    await waitFor(() => expect(list).toHaveFocus());
  });

  it("does not press on arrow keys", async () => {
    const onValueChange = vi.fn();
    render(
      <ToggleGroup aria-label="View" onValueChange={onValueChange} value={[]}>
        <GroupItems />
      </ToggleGroup>,
    );
    const [board] = screen.getAllByRole("button");

    board.focus();
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("activates with Enter and Space without submitting the form", () => {
    const onValueChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ToggleGroup aria-label="View" onValueChange={onValueChange}>
          <GroupItems />
        </ToggleGroup>
        <button type="submit">Save</button>
      </form>,
    );
    const [board] = screen.getAllByRole("button");
    // Negative control: the form is wired, so the zero below means something.
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    board.focus();
    pressKey(board, "Enter");
    expect(onValueChange).toHaveBeenLastCalledWith(
      ["board"],
      expect.anything(),
    );
    expect(board).toHaveAttribute("aria-pressed", "true");

    pressKey(board, " ");
    expect(onValueChange).toHaveBeenLastCalledWith([], expect.anything());
    expect(board).toHaveAttribute("aria-pressed", "false");

    // One change per key press, and the form never submitted.
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("exports Toggle and ToggleGroupSeparator", () => {
    render(
      <div>
        <Toggle aria-label="Star">Star</Toggle>
        <ToggleGroupSeparator />
      </div>,
    );
    expect(screen.getByRole("button", { name: "Star" })).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });
});

/**
 * A native button activates on the click its browser dispatches for Enter and
 * Space. jsdom does not dispatch one, and a wrapper may take the key over and
 * click itself instead, so a press is the key events plus that click only when
 * the element left the key to the browser.
 */
function pressKey(element: HTMLElement, key: string) {
  const leftToBrowser = fireEvent.keyDown(element, { key });
  fireEvent.keyUp(element, { key });
  if (leftToBrowser) {
    fireEvent.click(element);
  }
}
