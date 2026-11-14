import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Progress } from "./progress";

function indicator() {
  return document.querySelector('[data-slot="progress-indicator"]');
}

describe("Progress", () => {
  it("is a progressbar that reports the value", () => {
    render(<Progress value={40} />);
    const bar = screen.getByRole("progressbar");

    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("fills the track in proportion to the value", () => {
    render(<Progress value={40} />);

    expect(indicator()).toHaveStyle({ width: "40%" });
  });

  it("maps a value between its bounds", () => {
    render(<Progress value={3} min={1} max={5} />);
    const bar = screen.getByRole("progressbar");

    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemin", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    expect(indicator()).toHaveStyle({ width: "50%" });
  });

  it("has no value while indeterminate", () => {
    render(<Progress />);
    const bar = screen.getByRole("progressbar");

    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("data-indeterminate");
    expect(indicator()).not.toHaveAttribute("style");
  });

  it("renders a track and an indicator when given no children", () => {
    render(<Progress value={40} />);

    const track = document.querySelector('[data-slot="progress-track"]');
    expect(track).not.toBeNull();
    expect(track).toContainElement(indicator() as HTMLElement);
  });

  it("keeps the progress slot on the root and the caller classes", () => {
    render(<Progress value={40} className="w-16" />);
    const bar = screen.getByRole("progressbar");

    expect(bar).toHaveAttribute("data-slot", "progress");
    expect(bar).toHaveClass("w-16", "flex");
  });

  // Port regression: Base UI gave the indicator `height: inherit` inline; UI SDK
  // sets only the inline width, so the fill needs its own height to be visible.
  // jsdom does not apply the Tailwind sheet, so this asserts the class.
  it("gives the fill the height of the track", () => {
    render(<Progress value={40} />);

    expect(indicator()).toHaveClass("h-full");
  });
});
