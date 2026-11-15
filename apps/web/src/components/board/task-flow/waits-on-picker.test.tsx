import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WaitsOnPicker } from "./waits-on-picker";

afterEach(cleanup);

const CANDIDATES = [
  { id: "t1", key: "FF-1", title: "Write the report", status: "todo" as const },
  { id: "t2", key: "FF-2", title: "Review the plan", status: "todo" as const },
];

function Host({
  onOpenChange,
  onPick,
}: {
  onOpenChange: (open: boolean) => void;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <WaitsOnPicker
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        setOpen(next);
      }}
      candidates={CANDIDATES}
      onPick={onPick}
    />
  );
}

// UI SDK hides a filtered-out item with `hidden` and keeps it in the page.
const shown = (text: string) => {
  const element = screen.queryByText(text);
  return element !== null && element.closest("[hidden]") === null;
};

const input = () =>
  screen.getByPlaceholderText("workspace:board.waitsOn.searchPlaceholder");

describe("WaitsOnPicker", () => {
  it("filters the list as the user types", async () => {
    render(<Host onOpenChange={vi.fn()} onPick={vi.fn()} />);
    expect(shown("Write the report")).toBe(true);

    fireEvent.change(input(), { target: { value: "review" } });
    await waitFor(() => expect(shown("Write the report")).toBe(false));
    expect(shown("Review the plan")).toBe(true);
  });

  it("clears the query on the first Escape and closes on the second", async () => {
    const onOpenChange = vi.fn();
    render(<Host onOpenChange={onOpenChange} onPick={vi.fn()} />);
    fireEvent.change(input(), { target: { value: "review" } });
    await waitFor(() => expect(shown("Write the report")).toBe(false));

    fireEvent.keyDown(input(), { key: "Escape" });
    await waitFor(() => expect(input()).toHaveValue(""));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(shown("Write the report")).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input(), { key: "Escape" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
