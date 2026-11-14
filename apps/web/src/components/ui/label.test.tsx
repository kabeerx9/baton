import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Label } from "./label";

describe("Label", () => {
  it("renders a label pointing at its control", () => {
    render(
      <>
        <Label htmlFor="title">Title</Label>
        <input id="title" />
      </>,
    );

    const label = screen.getByText("Title");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", "title");
    expect(label).toHaveAttribute("data-slot", "label");
    expect(label.className).toContain("font-medium");
  });

  // A native label focuses its control on press; jsdom does not run that
  // activation behavior, so this asserts the wiring a browser acts on and the
  // browser checklist proves the press.
  it("names the control it points at", () => {
    render(
      <>
        <Label htmlFor="title">Title</Label>
        <input id="title" />
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
  });

  it("merges the caller's classes and handler", () => {
    const onClick = vi.fn();
    render(
      <Label className="cursor-ew-resize" onClick={onClick}>
        Width
      </Label>,
    );

    const label = screen.getByText("Width");
    expect(label.className).toContain("cursor-ew-resize");
    expect(label.className).toContain("font-medium");

    fireEvent.click(label);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a given element and keeps its own props", () => {
    render(
      <Label id="expires-label" render={<span data-label-for="expires" />}>
        Expires
      </Label>,
    );

    const label = screen.getByText("Expires");
    expect(label.tagName).toBe("SPAN");
    expect(label).toHaveAttribute("id", "expires-label");
    expect(label).toHaveAttribute("data-label-for", "expires");
    expect(label).toHaveAttribute("data-slot", "label");
  });

  it("renders from a function", () => {
    const view = vi.fn((props: Record<string, unknown>) => (
      <span {...props} data-label-for="expires" />
    ));

    render(
      <Label htmlFor="expires" render={view}>
        Expires
      </Label>,
    );

    const label = screen.getByText("Expires");
    expect(view).toHaveBeenCalledTimes(1);
    expect(label.tagName).toBe("SPAN");
    expect(label).toHaveAttribute("data-label-for", "expires");
    expect(label).toHaveAttribute("data-slot", "label");
  });

  it("forwards a ref", () => {
    const ref = React.createRef<HTMLLabelElement>();
    render(<Label ref={ref}>Ref</Label>);

    expect(ref.current).toBe(screen.getByText("Ref"));
  });
});
