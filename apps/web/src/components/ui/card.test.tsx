import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

describe("Card", () => {
  it("renders a div with its slot and classes", () => {
    render(<Card>Body</Card>);

    const card = screen.getByText("Body");
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveAttribute("data-slot", "card");
    expect(card.className).toContain("rounded-2xl");
    expect(card.className).toContain("bg-card");
  });

  it("merges the caller's classes, props and handler", () => {
    const onClick = vi.fn();
    render(
      <Card aria-label="Plan" className="max-w-md" id="plan" onClick={onClick}>
        Plan
      </Card>,
    );

    const card = screen.getByLabelText("Plan");
    expect(card).toHaveAttribute("id", "plan");
    expect(card.className).toContain("max-w-md");
    expect(card.className).toContain("rounded-2xl");

    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a given element and keeps its own props", () => {
    render(
      <Card render={<section aria-label="Details" data-layout="stack" />}>
        Details
      </Card>,
    );

    const section = screen.getByRole("region", { name: "Details" });
    expect(section.tagName).toBe("SECTION");
    expect(section).toHaveAttribute("data-layout", "stack");
    expect(section).toHaveAttribute("data-slot", "card");
    expect(section.className).toContain("rounded-2xl");
  });

  it("renders from a function", () => {
    const view = vi.fn((props: Record<string, unknown>) => (
      <article {...props} data-layout="stacked" />
    ));

    render(<Card render={view}>Details</Card>);

    const article = screen.getByRole("article");
    expect(view).toHaveBeenCalledTimes(1);
    expect(article).toHaveAttribute("data-layout", "stacked");
    expect(article).toHaveAttribute("data-slot", "card");
  });

  it("forwards a ref", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Card ref={ref}>Ref</Card>);

    expect(ref.current).toBe(screen.getByText("Ref"));
  });

  it("renders the header, title, description and content parts", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Weekly review</CardTitle>
          <CardDescription>Three tasks are waiting</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    );

    expect(screen.getByText("Weekly review")).toHaveAttribute(
      "data-slot",
      "card-title",
    );
    expect(screen.getByText("Three tasks are waiting")).toHaveAttribute(
      "data-slot",
      "card-description",
    );
    expect(screen.getByText("Weekly review").parentElement).toHaveAttribute(
      "data-slot",
      "card-header",
    );
    expect(screen.getByText("Body")).toHaveAttribute("data-slot", "card-panel");
  });

  it("keeps the caller's classes on a part", () => {
    render(<CardHeader className="pb-0">Header</CardHeader>);

    const header = screen.getByText("Header");
    expect(header.className).toContain("pb-0");
    expect(header.className).toContain("p-6");
  });
});
