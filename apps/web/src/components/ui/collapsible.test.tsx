import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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

  it("toggles from native button activation and keeps focus on the trigger", async () => {
    render(<Details />);
    const button = trigger();
    // Enter and Space reach a real button as a click from the browser; jsdom
    // does not synthesize it, so the test sends the same pair.
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    button.focus();

    await act(async () => {
      fireEvent.keyDown(button, { key: "Enter" });
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveFocus();

    await act(async () => {
      fireEvent.keyUp(button, { key: " " });
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
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

  it("does not open while disabled", async () => {
    render(<Details disabled />);
    const button = trigger();

    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Order #4189 shipped")).toBeNull();
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
