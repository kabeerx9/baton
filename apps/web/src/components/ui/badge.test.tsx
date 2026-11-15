import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders a span with its slot and default variant classes", () => {
    render(<Badge>New</Badge>);

    const badge = screen.getByText("New");
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge.className).toContain("bg-primary");
    expect(badge.className).toContain("h-5.5");
  });

  it("applies the variant and size classes", () => {
    render(
      <Badge size="sm" variant="destructive">
        Failed
      </Badge>,
    );

    const badge = screen.getByText("Failed");
    expect(badge.className).toContain("bg-destructive");
    expect(badge.className).not.toContain("bg-primary");
    expect(badge.className).toContain("h-5 ");
  });

  it("keeps the caller's classes and native props", () => {
    const onClick = vi.fn();
    render(
      <Badge className="ms-2" id="badge-id" onClick={onClick}>
        Tags
      </Badge>,
    );

    const badge = screen.getByText("Tags");
    expect(badge).toHaveAttribute("id", "badge-id");
    expect(badge.className).toContain("ms-2");
    expect(badge.className).toContain("bg-primary");

    fireEvent.click(badge);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a given element and keeps its own props", () => {
    render(
      <Badge render={<a href="/tasks/BATON-1" title="Task" />}>BATON-1</Badge>,
    );

    const link = screen.getByRole("link", { name: "BATON-1" });
    expect(link).toHaveAttribute("href", "/tasks/BATON-1");
    expect(link).toHaveAttribute("title", "Task");
    expect(link).toHaveAttribute("data-slot", "badge");
    expect(link.className).toContain("bg-primary");
  });

  it("renders from a function and forwards the caller's handler", () => {
    const onClick = vi.fn();
    const view = vi.fn(
      (props: Record<string, unknown>, state: Record<string, unknown>) => (
        <button type="button" {...props} data-state={JSON.stringify(state)} />
      ),
    );

    render(
      <Badge onClick={onClick} render={view}>
        Draft
      </Badge>,
    );

    const button = screen.getByRole("button", { name: "Draft" });
    expect(view).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-slot", "badge");
    expect(button.className).toContain("bg-primary");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards a ref to the rendered element", () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<Badge ref={ref}>Ref</Badge>);

    expect(ref.current).toBe(screen.getByText("Ref"));
  });
});
