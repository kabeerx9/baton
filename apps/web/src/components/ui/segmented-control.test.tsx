import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { SegmentedControl, SegmentedControlItem } from "./segmented-control";

function Demo({ onChoose }: { onChoose: (v: string) => void }) {
  return (
    <SegmentedControl aria-label="Status" value="b" onChoose={onChoose}>
      <SegmentedControlItem value="a">A</SegmentedControlItem>
      <SegmentedControlItem value="b">B</SegmentedControlItem>
      <SegmentedControlItem value="c">C</SegmentedControlItem>
    </SegmentedControl>
  );
}

describe("SegmentedControl", () => {
  it("names the checked step", () => {
    render(<Demo onChoose={() => {}} />);
    expect(
      screen.getByRole("radio", { name: "B" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("chooses on click", () => {
    const onChoose = vi.fn();
    render(<Demo onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("radio", { name: "C" }));
    expect(onChoose).toHaveBeenCalledWith("c");
  });

  it("does not choose when an arrow key only moves focus", () => {
    const onChoose = vi.fn();
    render(<Demo onChoose={onChoose} />);
    const b = screen.getByRole("radio", { name: "B" });
    b.focus();
    fireEvent.keyDown(b, { key: "ArrowRight" });
    expect(onChoose).not.toHaveBeenCalled();
  });
});
