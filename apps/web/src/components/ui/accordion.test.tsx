import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "./accordion";

const items = [
  { value: "one", label: "One", content: "First section" },
  { value: "two", label: "Two", content: "Second section" },
  { value: "three", label: "Three", content: "Third section" },
];

function Sections({
  multiple,
  defaultValue,
  onValueChange,
  disabledValue,
}: {
  multiple?: boolean;
  defaultValue?: string[];
  onValueChange?: (value: string | string[]) => void;
  disabledValue?: string;
}) {
  return (
    <Accordion
      defaultValue={defaultValue}
      multiple={multiple}
      onValueChange={onValueChange}
    >
      {items.map((item) => (
        <AccordionItem
          disabled={disabledValue === item.value}
          key={item.value}
          value={item.value}
        >
          <AccordionTrigger>{item.label}</AccordionTrigger>
          <AccordionPanel>{item.content}</AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function trigger(name: string) {
  return screen.getByRole("button", { name });
}

describe("Accordion", () => {
  it("puts each trigger in a heading and reports expanded state", () => {
    render(<Sections />);

    for (const item of items) {
      const heading = screen.getByRole("heading", { name: item.label });
      expect(heading.tagName).toBe("H3");
      const button = trigger(item.label);
      expect(heading).toContainElement(button);
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText(item.content)).toBeNull();
    }
  });

  it("opens an item, exposes its panel as a labelled region, and closes it again", async () => {
    const onValueChange = vi.fn();
    render(<Sections onValueChange={onValueChange} />);

    await act(async () => {
      fireEvent.click(trigger("One"));
    });
    expect(trigger("One")).toHaveAttribute("aria-expanded", "true");
    const region = screen.getByRole("region", { name: "One" });
    expect(region).toHaveTextContent("First section");
    expect(region).toHaveAttribute("data-slot", "accordion-panel");
    expect(trigger("One")).toHaveAttribute(
      "aria-controls",
      region.getAttribute("id") ?? "",
    );

    await act(async () => {
      fireEvent.click(trigger("One"));
    });
    expect(trigger("One")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "One" })).toBeNull();
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it("closes the open item when another opens", async () => {
    render(<Sections />);

    await act(async () => {
      fireEvent.click(trigger("One"));
    });
    await act(async () => {
      fireEvent.click(trigger("Two"));
    });

    expect(trigger("One")).toHaveAttribute("aria-expanded", "false");
    expect(trigger("Two")).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("First section")).toBeNull();
    expect(screen.getByText("Second section")).toBeInTheDocument();
  });

  it("keeps several items open in multiple mode", async () => {
    render(<Sections multiple />);

    await act(async () => {
      fireEvent.click(trigger("One"));
    });
    await act(async () => {
      fireEvent.click(trigger("Two"));
    });

    expect(trigger("One")).toHaveAttribute("aria-expanded", "true");
    expect(trigger("Two")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("First section")).toBeInTheDocument();
    expect(screen.getByText("Second section")).toBeInTheDocument();
  });

  it("reports the open items in onValueChange", async () => {
    const multiple = vi.fn();
    const single = vi.fn();
    const { unmount } = render(<Sections multiple onValueChange={multiple} />);

    await act(async () => {
      fireEvent.click(trigger("Two"));
    });
    expect(multiple).toHaveBeenCalledTimes(1);
    expect(multiple.mock.calls[0][0]).toContain("two");
    unmount();

    render(<Sections onValueChange={single} />);
    await act(async () => {
      fireEvent.click(trigger("Two"));
    });
    // Base UI reports a bare value when only one item may be open; UI SDK
    // reports the array in both modes. Normalize to compare the contract.
    const reported = single.mock.calls[0][0] as string | string[];
    expect(Array.isArray(reported) ? reported : [reported]).toEqual(["two"]);
  });

  it("follows a controlled value", async () => {
    const onValueChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState<string[]>(["two"]);
      return (
        <Accordion
          value={value}
          onValueChange={(next) => {
            onValueChange(next);
            setValue(Array.isArray(next) ? next : [next]);
          }}
        >
          {items.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger>{item.label}</AccordionTrigger>
              <AccordionPanel>{item.content}</AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      );
    }

    render(<Controlled />);
    expect(screen.getByText("Second section")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(trigger("One"));
    });
    expect(onValueChange).toHaveBeenCalled();
    expect(screen.getByText("First section")).toBeInTheDocument();
    expect(screen.queryByText("Second section")).toBeNull();
  });

  it("does not open a disabled item", async () => {
    render(<Sections disabledValue="two" />);
    const button = trigger("Two");

    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Second section")).toBeNull();
  });

  it("keeps the shared slot names and marks the open trigger", async () => {
    render(<Sections defaultValue={["one"]} />);

    expect(document.querySelector('[data-slot="accordion"]')).not.toBeNull();
    expect(
      document.querySelector('[data-slot="accordion-item"]'),
    ).not.toBeNull();
    const button = trigger("One");
    expect(button).toHaveAttribute("data-slot", "accordion-trigger");
    expect(button).toHaveAttribute("data-open");
    expect(trigger("Two")).not.toHaveAttribute("data-open");
    expect(
      document.querySelector('[data-slot="accordion-indicator"]'),
    ).not.toBeNull();
  });
});
