import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "./number-field";

type Props = Omit<React.ComponentProps<typeof NumberField>, "children"> & {
  invalid?: boolean;
};

function Counter({ invalid, ...props }: Props) {
  return (
    <NumberField {...props}>
      <NumberFieldGroup>
        <NumberFieldDecrement aria-label="Decrease" />
        <NumberFieldInput
          aria-invalid={invalid || undefined}
          aria-label="Quantity"
        />
        <NumberFieldIncrement aria-label="Increase" />
      </NumberFieldGroup>
    </NumberField>
  );
}

function input() {
  return screen.getByLabelText<HTMLInputElement>("Quantity");
}

function press(key: string, init: KeyboardEventInit = {}) {
  const proceeds = fireEvent.keyDown(input(), { key, ...init });
  fireEvent.keyUp(input(), { key, ...init });
  return proceeds;
}

describe("NumberField", () => {
  it("shows the value and keeps the stable slot names", () => {
    const { container } = render(<Counter defaultValue={3} size="sm" />);

    expect(input().value).toBe("3");
    expect(input().getAttribute("data-slot")).toBe("number-input-control");
    expect(
      container
        .querySelector("[data-slot=number-input]")
        ?.getAttribute("data-size"),
    ).toBe("sm");
    expect(
      container.querySelector("[data-slot=number-input-group]"),
    ).not.toBeNull();
    expect(screen.getByLabelText("Decrease").getAttribute("data-slot")).toBe(
      "number-input-decrement",
    );
    expect(screen.getByLabelText("Increase").getAttribute("data-slot")).toBe(
      "number-input-increment",
    );
  });

  it("steps with ArrowUp and ArrowDown and reports numbers", () => {
    const changes: unknown[] = [];
    render(
      <Counter
        defaultValue={4}
        onValueChange={(value) => changes.push(value)}
        step={2}
      />,
    );

    expect(press("ArrowUp")).toBe(false);
    expect(input().value).toBe("6");
    press("ArrowDown");
    press("ArrowDown");
    expect(input().value).toBe("2");
    expect(changes).toEqual([6, 4, 2]);
    expect(changes.every((value) => typeof value === "number")).toBe(true);
  });

  it("steps by ten steps with Shift and an arrow", () => {
    render(<Counter defaultValue={50} />);

    press("ArrowUp", { shiftKey: true });

    expect(input().value).toBe("60");
  });

  it("stops at min and max when stepping", () => {
    render(<Counter defaultValue={9} max={10} min={8} />);

    press("ArrowUp");
    press("ArrowUp");
    expect(input().value).toBe("10");
    press("ArrowDown");
    press("ArrowDown");
    press("ArrowDown");
    press("ArrowDown");
    expect(input().value).toBe("8");
  });

  it("clamps a typed value to max when it is committed", () => {
    const changes: unknown[] = [];
    render(
      <Counter
        defaultValue={5}
        max={10}
        min={1}
        onValueChange={(value) => changes.push(value)}
      />,
    );

    fireEvent.change(input(), { target: { value: "99" } });
    fireEvent.blur(input());

    expect(input().value).toBe("10");
    expect(changes.at(-1)).toBe(10);
  });

  it("clamps a typed value to min when it is committed", () => {
    render(<Counter defaultValue={5} max={10} min={1} />);

    fireEvent.change(input(), { target: { value: "-4" } });
    fireEvent.blur(input());

    expect(input().value).toBe("1");
  });

  it("steps with the buttons", () => {
    render(<Counter defaultValue={4} />);

    fireEvent.click(screen.getByLabelText("Increase"));
    fireEvent.click(screen.getByLabelText("Increase"));
    fireEvent.click(screen.getByLabelText("Decrease"));

    expect(input().value).toBe("5");
  });

  it("reports null for an empty input", () => {
    const changes: unknown[] = [];
    render(
      <Counter
        defaultValue={4}
        onValueChange={(value) => changes.push(value)}
      />,
    );

    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.blur(input());

    expect(changes.at(-1)).toBeNull();
  });

  it("stays controlled", () => {
    function Controlled() {
      const [value, setValue] = React.useState<number | null>(2);
      return <Counter onValueChange={setValue} value={value} />;
    }
    render(<Controlled />);

    press("ArrowUp");

    expect(input().value).toBe("3");
  });

  it("submits its numeric value under its name", () => {
    render(
      <form aria-label="Test form">
        <Counter defaultValue={4} name="amount" />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form");

    expect(new FormData(form).get("amount")).toBe("4");
    press("ArrowUp");
    expect(new FormData(form).get("amount")).toBe("5");
  });

  it("Enter is left to the browser, so the form submits", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Counter defaultValue={4} name="amount" />
        <button type="submit">Save</button>
      </form>,
    );

    const proceeds = fireEvent.keyDown(input(), { key: "Enter" });
    if (proceeds) {
      screen.getByRole<HTMLFormElement>("form").requestSubmit();
    }

    expect(proceeds).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("is natively disabled: input and buttons, none focusable", () => {
    render(<Counter defaultValue={4} disabled name="amount" />);

    for (const element of [
      input(),
      screen.getByLabelText<HTMLButtonElement>("Increase"),
      screen.getByLabelText<HTMLButtonElement>("Decrease"),
    ]) {
      expect(element.hasAttribute("disabled")).toBe(true);
      element.focus();
      expect(document.activeElement).not.toBe(element);
    }
  });

  it("does not change a disabled value from the keyboard", () => {
    render(<Counter defaultValue={4} disabled />);

    press("ArrowUp");

    expect(input().value).toBe("4");
  });

  it("keeps aria-invalid on the input", () => {
    render(<Counter defaultValue={4} invalid />);

    expect(input().getAttribute("aria-invalid")).toBe("true");
  });

  it("uses the id given to the root for the input", () => {
    render(<Counter defaultValue={4} id="lead-time" />);

    expect(input().id).toBe("lead-time");
  });

  it("names the input from its scrub area label", () => {
    render(
      <NumberField defaultValue={4} id="scrubbed">
        <NumberFieldScrubArea label="Amount" />
        <NumberFieldGroup>
          <NumberFieldInput />
        </NumberFieldGroup>
      </NumberField>,
    );

    expect(screen.getByLabelText("Amount")).toBe(
      document.getElementById("scrubbed"),
    );
  });

  it("refuses a scrub area outside a NumberField", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<NumberFieldScrubArea label="Amount" />)).toThrow();
    error.mockRestore();
  });
});

// Behavior UI SDK adds or changes. Base UI had no Page keys and snapped a
// stepped value to the nearest step from where it stood.
describe("NumberField (UI SDK stepping)", () => {
  it("steps by ten steps with PageUp and PageDown", () => {
    render(<Counter defaultValue={50} />);

    press("PageUp");
    expect(input().value).toBe("60");
    press("PageDown");
    press("PageDown");
    expect(input().value).toBe("40");
  });

  it("Home and End jump to the bounds", () => {
    render(<Counter defaultValue={5} max={9} min={2} />);

    press("End");
    expect(input().value).toBe("9");
    press("Home");
    expect(input().value).toBe("2");
  });

  it("disables a step button at its bound", () => {
    render(<Counter defaultValue={1} max={2} min={1} />);

    expect(screen.getByLabelText("Decrease").hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByLabelText("Increase").hasAttribute("disabled")).toBe(
      false,
    );
    fireEvent.click(screen.getByLabelText("Increase"));
    expect(screen.getByLabelText("Increase").hasAttribute("disabled")).toBe(
      true,
    );
  });

  // jsdom has no PointerEvent. UI SDK reports pointer drags with one, so the
  // test supplies a minimal one that carries movement.
  class TestPointerEvent extends MouseEvent {
    pointerId = 1;
    pointerType = "mouse";
    isPrimary = true;
    movementXValue: number;
    constructor(type: string, init: MouseEventInit & { movementX?: number }) {
      super(type, init);
      this.movementXValue = init.movementX ?? 0;
    }
    get movementX() {
      return this.movementXValue;
    }
  }
  beforeAll(() => {
    vi.stubGlobal("PointerEvent", TestPointerEvent);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  function pointer(
    target: Element | Document,
    type: string,
    init: { x: number; movementX?: number },
  ) {
    fireEvent(
      target,
      new TestPointerEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        clientX: init.x,
        clientY: 0,
        movementX: init.movementX,
      }),
    );
  }

  it("scrubs the value by dragging the label sideways", () => {
    const changes: unknown[] = [];
    render(
      <NumberField
        defaultValue={10}
        id="scrubbed"
        onValueChange={(value) => changes.push(value)}
      >
        <NumberFieldScrubArea label="Amount" pixelsPerStep={4} />
        <NumberFieldGroup>
          <NumberFieldInput />
        </NumberFieldGroup>
      </NumberField>,
    );
    const area = screen.getByText("Amount").closest("[data-slot]")
      ?.parentElement as HTMLElement;

    pointer(area, "pointerdown", { x: 0 });
    pointer(document, "pointermove", { x: 8, movementX: 8 });
    pointer(document, "pointerup", { x: 8 });

    expect(changes.length).toBeGreaterThan(0);
    expect(input2().value).toBe("12");
  });

  function scrubbed() {
    render(
      <NumberField defaultValue={10} id="scrubbed">
        <NumberFieldScrubArea label="Amount" pixelsPerStep={4} />
        <NumberFieldGroup>
          <NumberFieldInput />
        </NumberFieldGroup>
      </NumberField>,
    );
    return screen.getByText("Amount").closest("[data-slot]")
      ?.parentElement as HTMLElement;
  }

  it("a press on the scrub label without a drag focuses the input", () => {
    const area = scrubbed();

    pointer(area, "pointerdown", { x: 0 });
    pointer(document, "pointerup", { x: 0 });

    expect(document.activeElement).toBe(input2());
  });

  it("a drag does not focus the input", () => {
    const area = scrubbed();

    pointer(area, "pointerdown", { x: 0 });
    pointer(document, "pointermove", { x: 8, movementX: 8 });
    pointer(document, "pointerup", { x: 8 });

    expect(document.activeElement).not.toBe(input2());
  });

  function input2() {
    return document.getElementById("scrubbed") as HTMLInputElement;
  }
});
