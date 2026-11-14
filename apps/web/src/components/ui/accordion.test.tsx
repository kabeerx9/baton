import { act, fireEvent, render, screen } from "@testing-library/react";
import { type FormEvent, type KeyboardEvent, useState } from "react";
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
  disabled,
}: {
  multiple?: boolean;
  defaultValue?: string[];
  onValueChange?: (value: string | string[]) => void;
  disabledValue?: string;
  disabled?: boolean;
}) {
  return (
    <Accordion
      defaultValue={defaultValue}
      disabled={disabled}
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

// A native button activates on Enter (from keydown) or Space (from keyup) and
// then fires a click, unless that key event was canceled. jsdom has no default
// actions, so this replays the one browser rule the test depends on: a
// preventDefault on the key press suppresses the click, as it does in a browser.
function pressKey(element: HTMLElement, key: "Enter" | " ") {
  const pressed = fireEvent.keyDown(element, { key });
  if (key === " ") fireEvent.keyUp(element, { key });
  if (pressed) fireEvent.click(element);
  return pressed;
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

  it("reports the open items as an array in both modes", async () => {
    const multiple = vi.fn();
    const single = vi.fn();
    const { unmount } = render(<Sections multiple onValueChange={multiple} />);

    await act(async () => {
      fireEvent.click(trigger("Two"));
    });
    expect(multiple).toHaveBeenCalledTimes(1);
    expect(Array.isArray(multiple.mock.calls[0][0])).toBe(true);
    expect(multiple.mock.calls[0][0]).toEqual(["two"]);
    unmount();

    render(<Sections onValueChange={single} />);
    await act(async () => {
      fireEvent.click(trigger("Two"));
    });
    expect(single).toHaveBeenCalledTimes(1);
    expect(Array.isArray(single.mock.calls[0][0])).toBe(true);
    expect(single.mock.calls[0][0]).toEqual(["two"]);
  });

  it("activates on Enter and Space without submitting its form", async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Sections />
        <button type="submit">Submit</button>
      </form>,
    );
    const button = trigger("One");
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

  it("does not open an item when the key press is canceled", async () => {
    const onKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
    render(
      <Accordion>
        <AccordionItem value="one">
          <AccordionTrigger onKeyDown={onKeyDown}>One</AccordionTrigger>
          <AccordionPanel>First section</AccordionPanel>
        </AccordionItem>
      </Accordion>,
    );
    const button = trigger("One");

    await act(async () => {
      expect(pressKey(button, "Enter")).toBe(false);
    });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("First section")).toBeNull();
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

  it("renders a native disabled trigger for a disabled item", async () => {
    render(<Sections disabledValue="two" />);
    const button = trigger("Two");

    expect(button).toBeDisabled();
    button.focus();
    expect(button).not.toHaveFocus();

    await act(async () => {
      pressKey(button, "Enter");
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Second section")).toBeNull();
  });

  it("disables every trigger when the accordion is disabled", async () => {
    render(<Sections disabled />);

    for (const item of items) {
      const button = trigger(item.label);
      expect(button).toBeDisabled();
      button.focus();
      expect(button).not.toHaveFocus();
    }

    await act(async () => {
      pressKey(trigger("One"), "Enter");
    });
    expect(trigger("One")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("First section")).toBeNull();
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
