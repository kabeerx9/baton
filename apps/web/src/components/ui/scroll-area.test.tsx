import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { ScrollArea } from "./scroll-area";

const VIEWPORT = '[data-slot="scroll-area-viewport"]';
const SCROLLBAR = '[data-slot="scroll-area-scrollbar"]';

function viewport(): HTMLElement {
  const element = document.querySelector<HTMLElement>(VIEWPORT);
  if (!element) throw new Error("the scroll area rendered no viewport");
  return element;
}

function root(): HTMLElement {
  const element = viewport().parentElement;
  if (!element) throw new Error("the viewport has no root");
  return element;
}

function scrollbars(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(SCROLLBAR)];
}

// jsdom has no layout, so every box is 0 by 0 and the scroll area never sees
// overflow. Give the viewport the metrics a browser would report and let the
// parts measure again from the scroll event.
function measure({ x = 0, y = 0 } = {}) {
  const element = viewport();
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: 200,
  });
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    value: 200 + x,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: 120,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: 120 + y,
  });
  fireEvent.scroll(element);
}

async function renderBothAxes() {
  render(
    <ScrollArea>
      <div>content</div>
    </ScrollArea>,
  );
  measure({ x: 200, y: 200 });
  await waitFor(() => expect(scrollbars()).toHaveLength(2));
}

describe("ScrollArea", () => {
  it("renders a viewport, a scrollbar for each axis and a corner", async () => {
    await renderBothAxes();

    expect(viewport()).toHaveTextContent("content");

    const [vertical, horizontal] = scrollbars();
    expect(vertical).toHaveAttribute("data-orientation", "vertical");
    expect(horizontal).toHaveAttribute("data-orientation", "horizontal");
    // Screen readers scroll the viewport itself, not the drawn scrollbar.
    expect(vertical).toHaveAttribute("aria-hidden", "true");
    expect(horizontal).toHaveAttribute("aria-hidden", "true");
    expect(
      vertical.querySelector('[data-slot="scroll-area-thumb"]'),
    ).not.toBeNull();
    expect(
      horizontal.querySelector('[data-slot="scroll-area-thumb"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-slot="scroll-area-corner"]'),
    ).not.toBeNull();
    expect(root().contains(vertical)).toBe(true);
    expect(root().contains(horizontal)).toBe(true);
  });

  it("marks only the axis whose content overflows", async () => {
    render(
      <ScrollArea>
        <div>content</div>
      </ScrollArea>,
    );

    measure({ y: 200 });

    await waitFor(() =>
      expect(viewport()).toHaveAttribute("data-has-overflow-y"),
    );
    expect(viewport()).not.toHaveAttribute("data-has-overflow-x");
    expect(root()).toHaveAttribute("data-has-overflow-y");
    expect(root()).not.toHaveAttribute("data-has-overflow-x");

    measure({ x: 200, y: 200 });

    await waitFor(() =>
      expect(viewport()).toHaveAttribute("data-has-overflow-x"),
    );
    expect(root()).toHaveAttribute("data-has-overflow-x");
  });

  it("keeps the caller's className on the root and fills it", () => {
    render(
      <ScrollArea className="my-scroll">
        <div>content</div>
      </ScrollArea>,
    );

    const classes = root().className.split(" ");
    expect(classes).toContain("my-scroll");
    expect(classes).toContain("size-full");
    expect(classes).toContain("min-h-0");
  });

  it("adds the edge fade mask to the viewport only when asked", () => {
    const { unmount } = render(
      <ScrollArea>
        <div>content</div>
      </ScrollArea>,
    );
    expect(viewport().className).not.toContain("mask-t-from-");
    unmount();

    render(
      <ScrollArea scrollFade>
        <div>content</div>
      </ScrollArea>,
    );

    expect(viewport().className).toContain(
      "mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))]",
    );
    expect(viewport().className).toContain(
      "mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))]",
    );
  });

  it("gives the viewport a gutter only when asked", () => {
    const { unmount } = render(
      <ScrollArea>
        <div>content</div>
      </ScrollArea>,
    );
    expect(viewport()).not.toHaveClass("data-has-overflow-y:pe-2.5");
    unmount();

    render(
      <ScrollArea scrollbarGutter>
        <div>content</div>
      </ScrollArea>,
    );

    expect(viewport()).toHaveClass("data-has-overflow-y:pe-2.5");
    expect(viewport()).toHaveClass("data-has-overflow-x:pb-2.5");
  });

  it("shows the scrollbars while the pointer is over the area", async () => {
    await renderBothAxes();

    const [vertical, horizontal] = scrollbars();
    expect(vertical).not.toHaveAttribute("data-hovering");

    fireEvent.pointerEnter(root(), { pointerType: "mouse" });

    await waitFor(() => expect(vertical).toHaveAttribute("data-hovering"));
    expect(horizontal).toHaveAttribute("data-hovering");

    fireEvent.pointerLeave(root(), { pointerType: "mouse" });

    await waitFor(() => expect(vertical).not.toHaveAttribute("data-hovering"));
    expect(horizontal).not.toHaveAttribute("data-hovering");
  });
});
