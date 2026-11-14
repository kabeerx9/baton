/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
   The wrapper divs stand in for the clickable ancestor a popup must not reach;
   they are probes, not interactive UI. */
import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { containPopupEvents, isFromPopup } from "./popup-containment";

function Popup({
  children,
  containEvents = true,
  onClick,
}: {
  children?: React.ReactNode;
  containEvents?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}) {
  return (
    <div
      {...containPopupEvents(
        { "data-testid": "popup", onClick },
        containEvents,
      )}
    >
      {children}
    </div>
  );
}

describe("containPopupEvents", () => {
  it("stops every pointer and command event at the content", () => {
    const ancestor = {
      onClick: vi.fn(),
      onDoubleClick: vi.fn(),
      onContextMenu: vi.fn(),
      onPointerDown: vi.fn(),
      onMouseDown: vi.fn(),
    };

    render(
      <div {...ancestor}>
        <Popup>
          <button type="button">Act</button>
        </Popup>
      </div>,
    );
    const button = screen.getByRole("button", { name: "Act" });

    fireEvent.click(button);
    fireEvent.doubleClick(button);
    fireEvent.contextMenu(button);
    fireEvent.pointerDown(button, { pointerType: "mouse" });
    fireEvent.mouseDown(button);

    expect(ancestor.onClick).not.toHaveBeenCalled();
    expect(ancestor.onDoubleClick).not.toHaveBeenCalled();
    expect(ancestor.onContextMenu).not.toHaveBeenCalled();
    expect(ancestor.onPointerDown).not.toHaveBeenCalled();
    expect(ancestor.onMouseDown).not.toHaveBeenCalled();
  });

  it("stops a submit and a reset from an inner form, then lets both through when off", () => {
    const outer = vi.fn();
    const form = (containEvents: boolean) => (
      <form onReset={outer} onSubmit={outer}>
        <Popup containEvents={containEvents}>
          <form
            onSubmit={(event) => event.preventDefault()}
            onReset={(event) => event.preventDefault()}
          >
            <button type="submit">Save</button>
          </form>
        </Popup>
      </form>
    );

    const contained = render(form(true));
    fireEvent.submit(screen.getByRole("button", { name: "Save" }));
    fireEvent.reset(screen.getByRole("button", { name: "Save" }));
    expect(outer).not.toHaveBeenCalled();
    contained.unmount();

    render(form(false));
    fireEvent.submit(screen.getByRole("button", { name: "Save" }));
    fireEvent.reset(screen.getByRole("button", { name: "Save" }));
    expect(outer).toHaveBeenCalledTimes(2);
  });

  it("lets keys through to an ancestor handler and to document", () => {
    const onKeyDown = vi.fn();
    const onDocumentKeyDown = vi.fn();
    document.addEventListener("keydown", onDocumentKeyDown);

    try {
      render(
        <div onKeyDown={onKeyDown}>
          <Popup>
            <button type="button">Type</button>
          </Popup>
        </div>,
      );
      fireEvent.keyDown(screen.getByRole("button", { name: "Type" }), {
        key: "a",
      });

      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onDocumentKeyDown).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("keydown", onDocumentKeyDown);
    }
  });

  it("runs the caller's handler first and contains even when it prevents default", () => {
    const own = vi.fn((event: React.MouseEvent) => event.preventDefault());
    const ancestor = vi.fn();

    render(
      <div onClick={ancestor}>
        <Popup onClick={own}>
          <button type="button">Copy</button>
        </Popup>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(own).toHaveBeenCalledTimes(1);
    expect(ancestor).not.toHaveBeenCalled();
  });

  it("lets the event through when containment is off", () => {
    const ancestor = vi.fn();

    render(
      <div onClick={ancestor}>
        <Popup containEvents={false}>
          <button type="button">Open task</button>
        </Popup>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open task" }));

    expect(ancestor).toHaveBeenCalledTimes(1);
  });
});

describe("isFromPopup", () => {
  it("is true for a handler on the ancestor and false for one inside the popup", () => {
    let fromAncestor: boolean | null = null;
    let fromInside: boolean | null = null;

    render(
      <div
        onClick={(event) => {
          fromAncestor = isFromPopup(event);
        }}
      >
        <Popup containEvents={false}>
          <button
            onClick={(event) => {
              fromInside = isFromPopup(event);
            }}
            type="button"
          >
            Inside
          </button>
        </Popup>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Inside" }));

    expect(fromInside).toBe(false);
    expect(fromAncestor).toBe(true);
  });

  it("is false without an element target or a popup", () => {
    expect(isFromPopup({ target: null, currentTarget: null })).toBe(false);
    expect(
      isFromPopup({
        target: document,
        currentTarget: document.body,
      }),
    ).toBe(false);
  });
});

describe("natively nested content", () => {
  it("warns once per element when the content sits inside a button", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      render(
        <button type="button">
          <span>Open task</span>
          <Popup>
            <span>Waiting on Rohan</span>
          </Popup>
        </button>,
      );
      fireEvent.click(screen.getByText("Waiting on Rohan"));
      fireEvent.click(screen.getByText("Waiting on Rohan"));

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0]?.[0]).toContain("[popup-containment]");
      expect(error.mock.calls[0]?.[0]).toContain("container");
    } finally {
      error.mockRestore();
    }
  });

  it("stays quiet when nothing clickable holds the content", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      render(
        <div>
          <Popup>
            <span>Waiting on Rohan</span>
          </Popup>
        </div>,
      );
      fireEvent.click(screen.getByText("Waiting on Rohan"));

      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});
