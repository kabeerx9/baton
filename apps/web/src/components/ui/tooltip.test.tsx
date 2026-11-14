import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

// Base UI mounts the popup only while it is open. UI SDK keeps the content in
// the page and marks it data-closed while it is hidden. Both count as shown
// only when the content is mounted and not closed.
function shownTooltip() {
  const content = document.querySelector('[data-slot="tooltip-content"]');
  if (!(content instanceof HTMLElement)) return null;
  if (content.hasAttribute("data-closed")) return null;
  if (content.hasAttribute("hidden")) return null;
  return content;
}

// Base UI opens on mouseenter (React synthesizes it from mouseover) after a
// mouse-like pointer type. UI SDK opens on pointerenter.
function hover(element: HTMLElement) {
  fireEvent.pointerOver(element, { pointerType: "mouse" });
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseOver(element);
  fireEvent.mouseEnter(element);
  // Base UI's rest timer opens the tooltip from a mouse move.
  fireEvent.mouseMove(element, { movementX: 5, movementY: 5 });
}

function unhover(element: HTMLElement) {
  fireEvent.pointerOut(element, { pointerType: "mouse" });
  fireEvent.pointerLeave(element, { pointerType: "mouse" });
  fireEvent.mouseOut(element);
  fireEvent.mouseLeave(element);
  // UI SDK closes once the pointer leaves the area spanning the trigger and
  // the content; that area is all zeros in jsdom, so move well outside it.
  fireEvent.pointerMove(document, {
    clientX: 400,
    clientY: 400,
    pointerType: "mouse",
  });
  fireEvent.mouseMove(document, { clientX: 400, clientY: 400 });
}

describe("Tooltip", () => {
  it("opens when the pointer rests on the trigger and closes when it leaves", async () => {
    render(
      <Tooltip delay={0}>
        <TooltipTrigger>Share</TooltipTrigger>
        <TooltipContent>Anyone with the link can view</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Share" });
    expect(shownTooltip()).toBeNull();

    hover(trigger);
    await waitFor(() =>
      expect(shownTooltip()).toHaveTextContent("Anyone with the link can view"),
    );

    unhover(trigger);
    await waitFor(() => expect(shownTooltip()).toBeNull());
  });

  it("opens on keyboard focus and Escape closes it, leaving focus on the trigger", async () => {
    render(
      <Tooltip delay={0}>
        <TooltipTrigger>Bookmark</TooltipTrigger>
        <TooltipContent>Add to library</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Bookmark" });

    // UI SDK opens a tooltip on focus only when the focus came from a key.
    fireEvent.keyDown(document.body, { key: "Tab" });
    trigger.focus();
    expect(trigger).toHaveFocus();
    await waitFor(() =>
      expect(shownTooltip()).toHaveTextContent("Add to library"),
    );

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() => expect(shownTooltip()).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("shows no tooltip when the content is hidden", async () => {
    render(
      <Tooltip delay={0}>
        <TooltipTrigger>Collapse sidebar</TooltipTrigger>
        <TooltipContent hidden>Collapse</TooltipContent>
      </Tooltip>,
    );

    hover(screen.getByRole("button", { name: "Collapse sidebar" }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(shownTooltip()).toBeNull();
  });

  it("renders an asChild child as the trigger without an extra button", async () => {
    render(
      <Tooltip delay={0}>
        <TooltipTrigger asChild>
          <button type="button">Save</button>
        </TooltipTrigger>
        <TooltipContent>Save the task</TooltipContent>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Save" });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(trigger).toHaveAttribute("data-slot", "tooltip-trigger");

    hover(trigger);
    await waitFor(() =>
      expect(shownTooltip()).toHaveTextContent("Save the task"),
    );
  });

  it("renders a render element as the trigger and keeps its own props", async () => {
    render(
      <Tooltip delay={0}>
        <TooltipTrigger
          render={<button type="button" aria-label="More actions" />}
        >
          <span aria-hidden="true">...</span>
        </TooltipTrigger>
        <TooltipContent>More actions</TooltipContent>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveAttribute("data-slot", "tooltip-trigger");
    expect(trigger).toHaveTextContent("...");

    hover(trigger);
    await waitFor(() =>
      expect(shownTooltip()).toHaveTextContent("More actions"),
    );
  });

  it("keeps TooltipProvider as a pass-through around a working tooltip", async () => {
    render(
      <TooltipProvider>
        <Tooltip delay={0}>
          <TooltipTrigger>Filters</TooltipTrigger>
          <TooltipContent>Filter this list</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Filters" });
    hover(trigger);
    await waitFor(() =>
      expect(shownTooltip()).toHaveTextContent("Filter this list"),
    );
  });
});
