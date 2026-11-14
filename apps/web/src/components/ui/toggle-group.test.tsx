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

  it("disables every item when the group is disabled", () => {
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
    const items = screen.getAllByRole("button");
    for (const item of items) {
      expect(item).toHaveAttribute("data-disabled");
    }
    fireEvent.click(items[0]);
    expect(onValueChange).not.toHaveBeenCalled();
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

  it("does not submit a surrounding form on Enter", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ToggleGroup aria-label="View" value={[]}>
          <GroupItems />
        </ToggleGroup>
        <button type="submit">Save</button>
      </form>,
    );
    const [board] = screen.getAllByRole("button");

    board.focus();
    fireEvent.keyDown(board, { key: "Enter" });
    fireEvent.keyUp(board, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
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
