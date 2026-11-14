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

    await waitFor(() => expect(viewport()).toHaveAttribute("data-overflow-y"));
    expect(viewport()).not.toHaveAttribute("data-overflow-x");
    expect(root()).toHaveAttribute("data-overflow-y");
    expect(root()).not.toHaveAttribute("data-overflow-x");

    measure({ x: 200, y: 200 });

    await waitFor(() => expect(viewport()).toHaveAttribute("data-overflow-x"));
    expect(root()).toHaveAttribute("data-overflow-x");
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
    expect(viewport()).not.toHaveClass("data-overflow-y:pe-2.5");
    unmount();

    render(
      <ScrollArea scrollbarGutter>
        <div>content</div>
      </ScrollArea>,
    );

    expect(viewport()).toHaveClass("data-overflow-y:pe-2.5");
    expect(viewport()).toHaveClass("data-overflow-x:pb-2.5");
  });

  it("shows the scrollbars while the pointer is over the area", async () => {
    await renderBothAxes();

    const [vertical, horizontal] = scrollbars();
    expect(vertical).not.toHaveAttribute("data-visible");

    fireEvent.pointerEnter(root(), { pointerType: "mouse" });

    await waitFor(() => expect(vertical).toHaveAttribute("data-visible"));
    expect(horizontal).toHaveAttribute("data-visible");

    fireEvent.pointerLeave(root(), { pointerType: "mouse" });

    await waitFor(() => expect(vertical).not.toHaveAttribute("data-visible"));
    expect(horizontal).not.toHaveAttribute("data-visible");
  });
});

// Added behavior, approved by the coordinator: UI SDK drops the viewport's own
// tab stop once it holds focusable content. Base UI always made an overflowing
// viewport a tab stop. This block documents the new behavior, not a parity gap.
describe("added behavior: the viewport's tab stop", () => {
  function tabStops(): HTMLElement[] {
    return [
      ...document.querySelectorAll<HTMLElement>(
        "button, a[href], input, select, textarea, [tabindex]",
      ),
    ].filter(
      (element) => element.tabIndex >= 0 && !element.matches(":disabled"),
    );
  }

  it("makes an overflowing viewport with nothing focusable a tab stop", async () => {
    render(
      <ScrollArea>
        <p>plain content</p>
      </ScrollArea>,
    );

    measure({ y: 200 });

    await waitFor(() => expect(viewport()).toHaveAttribute("tabindex", "0"));
    expect(tabStops()).toEqual([viewport()]);
  });

  it("leaves Tab to a focusable child instead of the viewport", async () => {
    render(
      <ScrollArea>
        <button type="button">open</button>
      </ScrollArea>,
    );

    measure({ y: 200 });

    await waitFor(() => expect(viewport()).toHaveAttribute("data-overflow-y"));
    expect(viewport()).not.toHaveAttribute("tabindex");

    // jsdom does not run the browser's own Tab navigation, so check the order
    // it would walk: the button is the first stop and the viewport is none.
    const button = document.querySelector("button");
    if (!button) throw new Error("the button did not render");
    expect(tabStops()).toEqual([button]);

    button.focus();
    expect(button).toHaveFocus();
  });
});
