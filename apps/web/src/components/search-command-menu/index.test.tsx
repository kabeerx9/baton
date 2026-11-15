import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import SearchCommandMenu from "./index";

const searchResults = {
  results: [
    {
      id: "task-12",
      type: "task",
      title: "Collect the weekly report list",
      projectId: "project-1",
      projectSlug: "FF",
      taskNumber: 12,
    },
    {
      id: "task-23",
      type: "task",
      title: "Rewrite the workflow note",
      description: "Mentions FF-12 in passing.",
      projectId: "project-2",
      projectSlug: "PER",
      taskNumber: 23,
    },
  ],
};

vi.mock("@/hooks/queries/search/use-global-search", () => ({
  default: () => ({ data: searchResults }),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1" } }),
}));

vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  getModifierKeyText: () => "Ctrl",
  useRegisterShortcuts: vi.fn(),
}));

describe("SearchCommandMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a task found by its key even when its text does not contain the key", async () => {
    render(<SearchCommandMenu open setOpen={vi.fn()} />);

    fireEvent.change(
      screen.getByPlaceholderText("navigation:search.inputPlaceholder"),
      { target: { value: "FF-12" } },
    );

    expect(
      await screen.findByText("Collect the weekly report list"),
    ).toBeInTheDocument();
    expect(screen.getByText("Rewrite the workflow note")).toBeInTheDocument();
  });

  // Two-step Escape with `filter={false}`: the first Escape clears the query,
  // the second closes. The palette has the same rule with a filter.
  it("clears the query on the first Escape and closes on the second", async () => {
    const onOpenChange = vi.fn();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <SearchCommandMenu
          open={open}
          setOpen={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        />
      );
    }
    render(<Host />);
    const input = screen.getByPlaceholderText(
      "navigation:search.inputPlaceholder",
    );
    fireEvent.change(input, { target: { value: "FF-12" } });
    expect(
      await screen.findByText("Collect the weekly report list"),
    ).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(input).toHaveValue(""));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
