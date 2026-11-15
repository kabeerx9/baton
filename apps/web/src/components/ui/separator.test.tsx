import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Separator } from "./separator";

describe("Separator", () => {
  it("renders a horizontal separator", () => {
    render(<Separator />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("is announced with its orientation", () => {
    render(
      <>
        <Separator />
        <Separator orientation="vertical" />
      </>,
    );

    const [horizontal, vertical] = screen.getAllByRole("separator");
    expect(horizontal).toHaveAttribute("aria-orientation", "horizontal");
    expect(horizontal).toHaveAttribute("data-orientation", "horizontal");
    expect(vertical).toHaveAttribute("aria-orientation", "vertical");
    expect(vertical).toHaveAttribute("data-orientation", "vertical");
  });

  it("takes no focus", () => {
    render(<Separator />);
    const separator = screen.getByRole("separator");

    separator.focus();

    expect(separator).not.toHaveFocus();
    expect(separator).not.toHaveAttribute("tabindex");
  });

  it("keeps the separator slot and the caller class", () => {
    render(<Separator className="my-divider" />);
    const separator = screen.getByRole("separator");

    expect(separator).toHaveAttribute("data-slot", "separator");
    expect(separator).toHaveClass("bg-border", "my-divider");
  });
});
