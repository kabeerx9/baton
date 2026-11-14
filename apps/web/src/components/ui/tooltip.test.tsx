/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The ancestor div and the render element stand in for a clickable card around
   a popup; they are probes, not interactive UI. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import { expectPopupContainment } from "./popup-containment-test-utils";
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

function press(element: HTMLElement) {
  fireEvent.pointerDown(element, { pointerType: "mouse" });
  fireEvent.pointerUp(element, { pointerType: "mouse" });
  fireEvent.click(element);
}

async function openByHover(trigger: HTMLElement) {
  hover(trigger);
  await waitFor(() => expect(shownTooltip()).not.toBeNull());
}

async function openByFocus(trigger: HTMLElement) {
  // UI SDK opens a tooltip on focus only when the focus came from a key.
  fireEvent.keyDown(document.body, { key: "Tab" });
  trigger.focus();
  expect(trigger).toHaveFocus();
  await waitFor(() => expect(shownTooltip()).not.toBeNull());
}

async function expectClosed() {
  await waitFor(() => expect(shownTooltip()).toBeNull());
}

// The delay sits on the Tooltip root because that is the UI SDK contract. Base
// UI 1.9 takes its delay on the trigger or provider, so it ignores this prop
// and uses its own 600ms default; the waits below cover both.
describe("Tooltip parity", () => {
  it("opens when the pointer rests on the trigger and closes when it leaves", async () => {
    render(
      <Tooltip delay={0}>
        <TooltipTrigger>Share</TooltipTrigger>
        <TooltipContent>Anyone with the link can view</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Share" });
    expect(shownTooltip()).toBeNull();

    await openByHover(trigger);
    expect(shownTooltip()).toHaveTextContent("Anyone with the link can view");

    unhover(trigger);
    await expectClosed();
  });

  it("opens on keyboard focus and Escape closes it, leaving focus on the trigger", async () => {
    render(
      <Tooltip delay={0}>
        <TooltipTrigger>Bookmark</TooltipTrigger>
        <TooltipContent>Add to library</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Bookmark" });

    await openByFocus(trigger);
    expect(shownTooltip()).toHaveTextContent("Add to library");

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await expectClosed();
    expect(trigger).toHaveFocus();
  });

  it("reports open and close through onOpenChange with a boolean", async () => {
    const changes: boolean[] = [];
    render(
      <Tooltip delay={0} onOpenChange={(open) => changes.push(open)}>
        <TooltipTrigger>Pin</TooltipTrigger>
        <TooltipContent>Pin this task</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Pin" });

    await openByFocus(trigger);
    expect(changes).toEqual([true]);

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await expectClosed();
    expect(changes).toEqual([true, false]);
  });

  it("does not open while disabled", async () => {
    render(
      <Tooltip delay={0} disabled>
        <TooltipTrigger>Publish</TooltipTrigger>
        <TooltipContent>Add a title to publish</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Publish" });

    hover(trigger);
    // Past the real 600ms open delay, so an ignored `disabled` would show.
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(shownTooltip()).toBeNull();

    fireEvent.keyDown(document.body, { key: "Tab" });
    trigger.focus();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(trigger).toHaveFocus();
    expect(shownTooltip()).toBeNull();
  });

  it("closes when the trigger is pressed and still runs its own handler", async () => {
    const onClick = vi.fn();
    render(
      <Tooltip delay={0}>
        <TooltipTrigger onClick={onClick}>Copy</TooltipTrigger>
        <TooltipContent>Copy the link</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Copy" });

    await openByHover(trigger);
    press(trigger);
    await expectClosed();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("closes when the pointer presses outside", async () => {
    render(
      <Tooltip delay={0}>
        <TooltipTrigger>Filters</TooltipTrigger>
        <TooltipContent>Filter this list</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Filters" });

    await openByHover(trigger);
    fireEvent.pointerDown(document.body, { pointerType: "mouse" });
    fireEvent.mouseDown(document.body);
    await expectClosed();
  });

  it("shows no tooltip when its content is hidden", async () => {
    render(
      <Tooltip>
        <TooltipTrigger>Collapse sidebar</TooltipTrigger>
        <TooltipContent hidden>Collapse</TooltipContent>
      </Tooltip>,
    );

    // No delay override: wait past the real 600ms open delay, so the test
    // fails if `hidden` is ignored and the tooltip opens.
    hover(screen.getByRole("button", { name: "Collapse sidebar" }));
    await new Promise((resolve) => setTimeout(resolve, 900));
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

    await openByHover(trigger);
    expect(shownTooltip()).toHaveTextContent("Save the task");
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

    await openByHover(trigger);
    expect(shownTooltip()).toHaveTextContent("More actions");
  });

  it("keeps TooltipProvider as a pass-through around a working tooltip", async () => {
    render(
      <TooltipProvider>
        <Tooltip delay={0}>
          <TooltipTrigger>Archive</TooltipTrigger>
          <TooltipContent>Archive this task</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    await openByHover(screen.getByRole("button", { name: "Archive" }));
    expect(shownTooltip()).toHaveTextContent("Archive this task");
  });
});

// UI SDK adds the WAI-ARIA relationship on top of the old Base UI wrapper:
// its content has role="tooltip" and the trigger is described by it. Base UI
// 1.9 sets neither, so this block fails against the pre-port wrapper and is
// kept separate from the parity contract above.
describe("Tooltip added behavior (UI SDK)", () => {
  it("describes its trigger with the content id and exposes role=tooltip", async () => {
    render(
      <Tooltip delay={0}>
        <TooltipTrigger>Notifications</TooltipTrigger>
        <TooltipContent>Turn notifications on</TooltipContent>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Notifications" });

    const describes = trigger.getAttribute("aria-describedby");
    expect(describes).toBeTruthy();
    const content = document.getElementById(describes ?? "");
    expect(content).not.toBeNull();
    expect(content).toHaveAttribute("role", "tooltip");
    expect(content).toHaveTextContent("Turn notifications on");

    await openByHover(trigger);
    expect(shownTooltip()).toBe(content);
    expect(trigger).toHaveAttribute("aria-describedby", content?.id);
  });
});

// Section 11: a tooltip can sit inside a board card link, so a click on its
// content must stop before the link. The helper checks the whole rule.
describe("Tooltip event containment", () => {
  it("contains pointer and command events from its content", async () => {
    await expectPopupContainment({
      render: ({ containEvents, contentProps, control }) => (
        <Tooltip delay={0}>
          <TooltipTrigger>Waiting</TooltipTrigger>
          <TooltipContent containEvents={containEvents} {...contentProps}>
            {control}
          </TooltipContent>
        </Tooltip>
      ),
      open: async () => {
        await openByHover(screen.getByRole("button", { name: "Waiting" }));
      },
      content: () => {
        const content = shownTooltip();
        if (!content) throw new Error("the tooltip did not open");
        return content;
      },
    });
  });

  // UI SDK runs a `render` element's handlers after the part's and skips the
  // part's handler when the element prevents the default, so the wrapper must
  // contain that element too.
  it("contains a click on a render element that prevents the default", async () => {
    const ancestor = vi.fn();

    render(
      <div onClick={ancestor}>
        <Tooltip delay={0}>
          <TooltipTrigger>Waiting</TooltipTrigger>
          <TooltipContent
            render={<div onClick={(event) => event.preventDefault()} />}
          >
            Rendered detail
          </TooltipContent>
        </Tooltip>
      </div>,
    );
    await openByHover(screen.getByRole("button", { name: "Waiting" }));

    const content = shownTooltip();
    if (!content) throw new Error("the tooltip did not open");
    expect(content).toHaveAttribute("data-slot", "tooltip-content");

    fireEvent.click(content);
    expect(ancestor).not.toHaveBeenCalled();
  });
});
