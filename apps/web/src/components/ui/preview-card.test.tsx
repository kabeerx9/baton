import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./preview-card";

const DELAY = 30;

// Base UI opens on native mouseenter; UI SDK binds native pointerenter. Fire
// all three so one test contract covers either wrapper.
function hover(element: Element) {
  fireEvent.pointerOver(element, { pointerType: "mouse" });
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseEnter(element);
}

function unhover(element: Element) {
  // A point far from the zero-sized jsdom rects, so the pointer-to-card bridge
  // does not read the move as still inside the card.
  fireEvent.pointerOut(element, {
    pointerType: "mouse",
    clientX: 1000,
    clientY: 1000,
    relatedTarget: document.body,
  });
  fireEvent.pointerLeave(element, {
    pointerType: "mouse",
    clientX: 1000,
    clientY: 1000,
    relatedTarget: document.body,
  });
  fireEvent.mouseLeave(element, { relatedTarget: document.body });
}

function Preview({
  children,
  onOpenChange,
  side = "top",
}: {
  children?: React.ReactNode;
  onOpenChange?: (open: boolean, details: { reason: string }) => void;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <HoverCard closeDelay={DELAY} openDelay={DELAY} onOpenChange={onOpenChange}>
      <HoverCardTrigger asChild>
        <a href="/tasks/BATON-1">BATON-1 Fix the preview</a>
      </HoverCardTrigger>
      <HoverCardContent side={side}>
        {children ?? <p>Preview body</p>}
      </HoverCardContent>
    </HoverCard>
  );
}

describe("HoverCard", () => {
  it("opens the content after the open delay on hover", async () => {
    render(<Preview />);

    const link = screen.getByRole("link", { name: "BATON-1 Fix the preview" });
    expect(screen.queryByText("Preview body")).not.toBeInTheDocument();

    hover(link);
    expect(screen.queryByText("Preview body")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Preview body")).toBeInTheDocument();
    });
  });

  it("closes the content after the close delay when the pointer leaves", async () => {
    render(<Preview />);

    const link = screen.getByRole("link", { name: "BATON-1 Fix the preview" });
    hover(link);
    await waitFor(() => {
      expect(screen.getByText("Preview body")).toBeInTheDocument();
    });

    unhover(link);
    await waitFor(() => {
      expect(screen.queryByText("Preview body")).not.toBeInTheDocument();
    });
  });

  it("opens on keyboard focus and closes on Escape, leaving focus on the trigger", async () => {
    render(<Preview />);

    const link = screen.getByRole("link", { name: "BATON-1 Fix the preview" });
    // Programmatic focus alone is not keyboard focus in every library; Tab
    // first is what a person does.
    fireEvent.keyDown(document, { key: "Tab" });
    act(() => link.focus());
    expect(link).toHaveFocus();

    await waitFor(() => {
      expect(screen.getByText("Preview body")).toBeInTheDocument();
    });

    fireEvent.keyDown(link, { key: "Escape", code: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Preview body")).not.toBeInTheDocument();
    });
    expect(link).toHaveFocus();
  });

  it("reports open changes as a boolean and a reason", async () => {
    const onOpenChange = vi.fn();
    render(<Preview onOpenChange={onOpenChange} />);

    const link = screen.getByRole("link", { name: "BATON-1 Fix the preview" });
    hover(link);
    await waitFor(() => {
      expect(screen.getByText("Preview body")).toBeInTheDocument();
    });
    fireEvent.keyDown(link, { key: "Escape", code: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: "trigger-hover" }),
    );
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: "escape-key" }),
      );
    });
    expect(typeof onOpenChange.mock.calls[0]?.[0]).toBe("boolean");
  });

  it("renders the trigger as one anchor, also when asChild supplies it", async () => {
    const { container } = render(<Preview />);

    expect(container.querySelectorAll("a")).toHaveLength(1);

    const link = screen.getByRole("link", { name: "BATON-1 Fix the preview" });
    hover(link);
    await waitFor(() => {
      expect(screen.getByText("Preview body")).toBeInTheDocument();
    });
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("renders the default anchor when the trigger is not asChild", () => {
    render(
      <HoverCard>
        <HoverCardTrigger>
          <span>Kabeer</span>
        </HoverCardTrigger>
        <HoverCardContent>
          <p>Preview body</p>
        </HoverCardContent>
      </HoverCard>,
    );

    const name = screen.getByText("Kabeer");
    expect(name.closest("a")).toBe(name.parentElement);
  });

  it("puts an aria-label on the trigger, also when asChild supplies it", () => {
    render(
      <HoverCard>
        <HoverCardTrigger aria-label="Tin" asChild>
          <span>Tin</span>
        </HoverCardTrigger>
        <HoverCardContent>
          <p>Preview body</p>
        </HoverCardContent>
      </HoverCard>,
    );

    expect(screen.getByLabelText("Tin")).toBe(screen.getByText("Tin"));
  });

  it("opens on the requested side", async () => {
    render(<Preview side="bottom" />);

    const link = screen.getByRole("link", { name: "BATON-1 Fix the preview" });
    hover(link);
    await waitFor(() => {
      expect(screen.getByText("Preview body")).toBeInTheDocument();
    });

    expect(screen.getByText("Preview body").parentElement).toHaveAttribute(
      "data-side",
      "bottom",
    );
  });
});
