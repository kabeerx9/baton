import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Tabs, TabsList, TabsPanel, TabsTab } from "./tabs";

function Example({
  onValueChange,
}: {
  onValueChange?: (value: unknown) => void;
}) {
  return (
    <Tabs defaultValue="one" onValueChange={onValueChange}>
      <TabsList aria-label="Clients">
        <TabsTab value="one">One</TabsTab>
        <TabsTab value="two">Two</TabsTab>
        <TabsTab value="three" disabled>
          Three
        </TabsTab>
      </TabsList>
      <TabsPanel value="one">First panel</TabsPanel>
      <TabsPanel value="two">Second panel</TabsPanel>
      <TabsPanel value="three">Third panel</TabsPanel>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("selects the default tab and shows only its panel", () => {
    render(<Example />);

    expect(
      screen.getByRole("tablist", { name: "Clients" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("First panel")).toBeVisible();
    expect(screen.queryByText("Second panel")).not.toBeInTheDocument();
  });

  it("switches panels on click and reports the new value", () => {
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Two" }));

    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Second panel")).toBeVisible();
    expect(onValueChange).toHaveBeenCalledWith("two", expect.anything());
  });

  it("does not select a disabled tab", () => {
    render(<Example />);

    fireEvent.click(screen.getByRole("tab", { name: "Three" }));

    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByText("Third panel")).not.toBeInTheDocument();
  });

  it("tags parts with their slots", () => {
    render(<Example />);

    expect(screen.getByRole("tablist")).toHaveAttribute(
      "data-slot",
      "tabs-list",
    );
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute(
      "data-slot",
      "tabs-tab",
    );
  });
});
