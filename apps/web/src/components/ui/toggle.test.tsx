import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Toggle } from "./toggle";

describe("Toggle parity (passes on the Base UI wrapper)", () => {
  it("renders a native button that starts unpressed", () => {
    render(<Toggle aria-label="Star">Star</Toggle>);

    const button = screen.getByRole("button", { name: "Star" });
    expect(button.tagName).toBe("BUTTON");
    // A toggle never submits a form.
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-slot", "toggle");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toHaveAttribute("data-pressed");
  });

  it("presses on click, unpresses on the next click, and reports booleans", () => {
    const onPressedChange = vi.fn();
    render(
      <Toggle aria-label="Star" onPressedChange={onPressedChange}>
        Star
      </Toggle>,
    );
    const button = screen.getByRole("button", { name: "Star" });

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-pressed");
    expect(onPressedChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(typeof onPressedChange.mock.calls[0][0]).toBe("boolean");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toHaveAttribute("data-pressed");
    expect(onPressedChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  it("can start pressed", () => {
    render(<Toggle defaultPressed>Star</Toggle>);
    const button = screen.getByRole("button", { name: "Star" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-pressed");
  });

  it("follows a controlled pressed prop", () => {
    const onPressedChange = vi.fn();
    const { rerender } = render(
      <Toggle onPressedChange={onPressedChange} pressed={false}>
        Star
      </Toggle>,
    );
    const button = screen.getByRole("button", { name: "Star" });

    fireEvent.click(button);
    expect(onPressedChange).toHaveBeenCalledTimes(1);
    // The owner has not accepted the change yet.
    expect(button).toHaveAttribute("aria-pressed", "false");

    rerender(
      <Toggle onPressedChange={onPressedChange} pressed>
        Star
      </Toggle>,
    );
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-pressed");
  });

  it("is natively disabled and ignores presses", () => {
    const onPressedChange = vi.fn();
    render(
      <Toggle disabled onPressedChange={onPressedChange}>
        Star
      </Toggle>,
    );
    const button = screen.getByRole("button", { name: "Star" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");
    fireEvent.click(button);
    expect(onPressedChange).not.toHaveBeenCalled();
  });

  it("keeps the caller's className and content", () => {
    render(<Toggle className="extra">Starred</Toggle>);
    const button = screen.getByRole("button", { name: "Starred" });
    expect(button.className).toContain("extra");
    expect(button).toHaveTextContent("Starred");
  });

  it("does not submit a surrounding form on Enter", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Toggle aria-label="Star">Star</Toggle>
        <button type="submit">Save</button>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Star" });

    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyUp(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });
    fireEvent.keyUp(button, { key: " " });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
