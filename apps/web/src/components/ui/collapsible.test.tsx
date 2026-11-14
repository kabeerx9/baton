import { act, fireEvent, render, screen } from "@testing-library/react";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "./collapsible";

function Details({
  onOpenChange,
  disabled,
  defaultOpen,
}: {
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      disabled={disabled}
      onOpenChange={onOpenChange}
    >
      <CollapsibleTrigger>Details</CollapsibleTrigger>
      <CollapsiblePanel>Order #4189 shipped</CollapsiblePanel>
    </Collapsible>
  );
}

function trigger() {
  return screen.getByRole("button", { name: "Details" });
}

// A native button activates on Enter (from keydown) or Space (from keyup) and
// then fires a click, unless that key event was canceled. jsdom has no default
// actions, so this replays the one browser rule the test depends on: a
// preventDefault on the key press suppresses the click, as it does in a browser.
function pressKey(element: HTMLElement, key: "Enter" | " ") {
  if (key === "Enter") {
    const pressed = fireEvent.keyDown(element, { key });
    if (pressed) fireEvent.click(element);
    return pressed;
  }
  // Space activates from keyup, so a canceled keyup suppresses the click.
  const down = fireEvent.keyDown(element, { key });
  const up = fireEvent.keyUp(element, { key });
  if (down && up) fireEvent.click(element);
  return up;
}

describe("Collapsible", () => {
  it("opens and closes from the trigger and reports booleans", async () => {
    const onOpenChange = vi.fn();
    render(<Details onOpenChange={onOpenChange} />);

    const button = trigger();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Order #4189 shipped")).toBeNull();

    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-expanded", "true");
    const panelId = button.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId ?? "");
    expect(panel).not.toBeNull();
    expect(panel).toHaveTextContent("Order #4189 shipped");
    expect(panel).toHaveAttribute("data-slot", "collapsible-panel");

    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Order #4189 shipped")).toBeNull();

    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[1][0]).toBe(false);
  });

  it("activates on Enter and Space without submitting its form", async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Details />
        <button type="submit">Submit</button>
      </form>,
    );
    const button = trigger();
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    button.focus();
    expect(button).toHaveFocus();

    await act(async () => {
      pressKey(button, "Enter");
    });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveFocus();

    await act(async () => {
      pressKey(button, " ");
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();

    // Negative control: the same press does submit from a submit button, so
    // the zero above comes from the trigger's type, not from a test that
    // cannot fail.
    await act(async () => {
      pressKey(screen.getByRole("button", { name: "Submit" }), "Enter");
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not open when a key press is canceled", async () => {
    const onKeyDown = vi.fn((event: KeyboardEvent) => {
      if (event.key === "Enter") event.preventDefault();
    });
    const onKeyUp = vi.fn((event: KeyboardEvent) => {
      if (event.key === " ") event.preventDefault();
    });
    render(
      <Collapsible>
        <CollapsibleTrigger onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
          Details
        </CollapsibleTrigger>
        <CollapsiblePanel>Order #4189 shipped</CollapsiblePanel>
      </Collapsible>,
    );
    const button = trigger();

    await act(async () => {
      expect(pressKey(button, "Enter")).toBe(false);
    });
    expect(button).toHaveAttribute("aria-expanded", "false");

    // Space activates from keyup, so canceling the keyup alone must stop it.
    await act(async () => {
      expect(pressKey(button, " ")).toBe(false);
    });
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(onKeyUp).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Order #4189 shipped")).toBeNull();
  });

  it("stays open while a controlled prop does not change", async () => {
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(true);
      return (
        <Collapsible
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            if (next) setOpen(next);
          }}
        >
          <CollapsibleTrigger>Details</CollapsibleTrigger>
          <CollapsiblePanel>Order #4189 shipped</CollapsiblePanel>
        </Collapsible>
      );
    }

    render(<Controlled />);
    expect(screen.getByText("Order #4189 shipped")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(trigger());
    });
    // The callback ran, the owner refused the change, so the panel stays open.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByText("Order #4189 shipped")).toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("renders the trigger as the child element when given asChild", async () => {
    render(
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button className="custom" type="button">
            Details
          </button>
        </CollapsibleTrigger>
        <CollapsiblePanel>Order #4189 shipped</CollapsiblePanel>
      </Collapsible>,
    );

    const button = trigger();
    expect(button).toHaveClass("custom");
    expect(button.querySelector("button")).toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");

    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Order #4189 shipped")).toBeInTheDocument();
  });

  it("renders a native disabled trigger and blocks focus and activation", async () => {
    render(<Details disabled />);
    const button = trigger();

    expect(button).toBeDisabled();
    button.focus();
    expect(button).not.toHaveFocus();

    await act(async () => {
      pressKey(button, "Enter");
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Order #4189 shipped")).toBeNull();
  });

  it("renders a native disabled asChild button when the root is disabled", async () => {
    render(
      <Collapsible disabled>
        <CollapsibleTrigger asChild>
          <button type="button">Details</button>
        </CollapsibleTrigger>
        <CollapsiblePanel>Order #4189 shipped</CollapsiblePanel>
      </Collapsible>,
    );
    const button = trigger();

    expect(button).toBeDisabled();
    button.focus();
    expect(button).not.toHaveFocus();

    await act(async () => {
      pressKey(button, "Enter");
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Order #4189 shipped")).toBeNull();
  });

  it("keeps aria-disabled only when the rendered trigger is not a button", async () => {
    render(
      <Collapsible disabled>
        <CollapsibleTrigger render={<a href="#details">Details</a>} />
        <CollapsiblePanel>Order #4189 shipped</CollapsiblePanel>
      </Collapsible>,
    );
    const link = screen.getByText("Details").closest("a");
    expect(link).not.toBeNull();

    expect(link).not.toHaveAttribute("disabled");
    expect(link).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the shared slot names", () => {
    render(<Details defaultOpen />);
    expect(document.querySelector('[data-slot="collapsible"]')).not.toBeNull();
    expect(trigger()).toHaveAttribute("data-slot", "collapsible-trigger");
    expect(
      document.getElementById(trigger().getAttribute("aria-controls") ?? ""),
    ).toHaveAttribute("data-slot", "collapsible-panel");
  });
});
