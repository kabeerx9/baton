import { cleanup, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { expect, vi } from "vite-plus/test";

/**
 * A popup to check, closed. The helper renders it twice: once with containment
 * and once with `containEvents={false}`.
 */
export type PopupContainmentCase = {
  /**
   * Renders one closed popup. Spread `contentProps` on the content part and
   * put `control` inside the content: the helper presses, clicks and types on
   * that control and checks both handlers.
   */
  render: (options: {
    containEvents: boolean;
    contentProps: { onClick: (event: React.MouseEvent) => void };
    control: React.ReactElement;
  }) => React.ReactNode;
  /** Opens the popup and resolves once its content is in the page. */
  open: () => Promise<void>;
  /** The open content element, as the popup mounts it. */
  content: () => Element;
  /** Dialog kinds only: the backdrop, so a press on it is checked too. */
  backdrop?: () => Element | null;
};

type MouseMock = ReturnType<
  typeof vi.fn<React.MouseEventHandler<HTMLDivElement>>
>;
type PointerMock = ReturnType<
  typeof vi.fn<React.PointerEventHandler<HTMLDivElement>>
>;
type KeyboardMock = ReturnType<
  typeof vi.fn<React.KeyboardEventHandler<HTMLDivElement>>
>;
type AnyMock = { mockClear: () => void };

type Spies = {
  onClick: MouseMock;
  onPointerDown: PointerMock;
  onMouseDown: MouseMock;
  onContextMenu: MouseMock;
  onKeyDown: KeyboardMock;
};

function spies(): Spies {
  return {
    onClick: vi.fn<React.MouseEventHandler<HTMLDivElement>>(),
    onPointerDown: vi.fn<React.PointerEventHandler<HTMLDivElement>>(),
    onMouseDown: vi.fn<React.MouseEventHandler<HTMLDivElement>>(),
    onContextMenu: vi.fn<React.MouseEventHandler<HTMLDivElement>>(),
    onKeyDown: vi.fn<React.KeyboardEventHandler<HTMLDivElement>>(),
  };
}

/**
 * Drops what the opener left behind. Opening is a real interaction on an
 * element inside the probe: a menu opens on a click, a context menu on a right
 * click, and a keyboard opener types. Those calls are allowed, and only what
 * happens after the popup is open says whether containment holds.
 */
function reset(target: Spies, ...others: AnyMock[]) {
  for (const spy of Object.values(target)) spy.mockClear();
  for (const other of others) other.mockClear();
}

/**
 * The seven checks every popup job adds (record section 11): pointer and
 * command events from the content stop at the content, keys and document
 * listeners still run, the content's own handlers still run, and
 * `containEvents={false}` switches containment off.
 *
 * The content must stay in the page while the popup closes, which UI SDK's
 * popups do. A popup that unmounts its content on press fails the control
 * assertions below rather than passing them without an event.
 */
export async function expectPopupContainment(
  popupCase: PopupContainmentCase,
): Promise<void> {
  const contained = spies();
  const contentClick = vi.fn((event: React.MouseEvent) =>
    event.preventDefault(),
  );
  const controlClick = vi.fn();
  const documentKeyDown = vi.fn();
  const control = (
    <button data-popup-control="" onClick={controlClick} type="button">
      Contained control
    </button>
  );

  document.addEventListener("keydown", documentKeyDown);
  try {
    render(
      <div {...contained}>
        {popupCase.render({
          containEvents: true,
          contentProps: { onClick: contentClick },
          control,
        })}
      </div>,
    );
    await popupCase.open();
    reset(contained, documentKeyDown, controlClick, contentClick);

    const content = popupCase.content();
    expect(content.isConnected, "the popup content is in the page").toBe(true);
    const controlElement = document.querySelector("[data-popup-control]");
    if (!(controlElement instanceof HTMLElement)) {
      throw new Error("the control must be rendered inside the popup content");
    }

    // Keys are never contained: the popup's own keys, the shortcut registry
    // and Escape all listen on document.
    fireEvent.keyDown(controlElement, { key: "a" });
    expect(
      contained.onKeyDown,
      "a key inside the content must reach the ancestor",
    ).toHaveBeenCalledTimes(1);
    expect(
      documentKeyDown,
      "a key inside the content must reach document listeners",
    ).toHaveBeenCalledTimes(1);

    // A press and a context click inside the content stay there.
    fireEvent.pointerDown(controlElement, { pointerType: "mouse" });
    expect(
      contained.onPointerDown,
      "a pointer press inside the content reached its ancestor",
    ).not.toHaveBeenCalled();
    fireEvent.mouseDown(controlElement);
    expect(
      contained.onMouseDown,
      "a mouse press inside the content reached its ancestor",
    ).not.toHaveBeenCalled();
    fireEvent.contextMenu(controlElement);
    expect(
      contained.onContextMenu,
      "a context click inside the content reached its ancestor",
    ).not.toHaveBeenCalled();

    // The control and the content keep their own click handlers, and
    // `preventDefault()` in the content's handler does not skip containment.
    fireEvent.click(controlElement);
    expect(
      controlClick,
      "a click must still run the control's own handler",
    ).toHaveBeenCalledTimes(1);
    expect(
      contentClick,
      "a click must still run the content's own handler",
    ).toHaveBeenCalledTimes(1);
    expect(
      contained.onClick,
      "a click inside the content reached its ancestor",
    ).not.toHaveBeenCalled();
  } finally {
    document.removeEventListener("keydown", documentKeyDown);
    cleanup();
  }

  if (popupCase.backdrop) {
    const withBackdrop = spies();
    render(
      <div {...withBackdrop}>
        {popupCase.render({
          containEvents: true,
          contentProps: { onClick: vi.fn() },
          control: <button type="button">Backdrop control</button>,
        })}
      </div>,
    );
    await popupCase.open();
    reset(withBackdrop);

    const backdrop = popupCase.backdrop();
    expect(backdrop, "the dialog renders a backdrop").not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(
      withBackdrop.onClick,
      "a click on the backdrop reached its ancestor",
    ).not.toHaveBeenCalled();
    cleanup();
  }

  // The opt-out reaches the ancestor again.
  const optedOut = spies();
  render(
    <div {...optedOut}>
      {popupCase.render({
        containEvents: false,
        contentProps: { onClick: vi.fn() },
        control: <button type="button">Opted-out control</button>,
      })}
    </div>,
  );
  await popupCase.open();
  reset(optedOut);

  fireEvent.click(popupCase.content());
  expect(
    optedOut.onClick,
    "containEvents={false} must let the click through to the ancestor",
  ).toHaveBeenCalledTimes(1);
  cleanup();
}
