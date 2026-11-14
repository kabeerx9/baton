import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Checkbox } from "./checkbox";

// jsdom does not run the browser's Space activation on a native button, so this
// does what the platform would: press, release, and click when the key press was
// not handled and its default was not prevented.
function pressSpace(element: HTMLElement) {
  const handled = !fireEvent.keyDown(element, { key: " " });
  fireEvent.keyUp(element, { key: " " });
  if (!handled) {
    fireEvent.click(element);
  }
}

function formSubmitSpy() {
  return vi.fn((event: { preventDefault: () => void }) => {
    event.preventDefault();
  });
}

describe("Checkbox", () => {
  it("is a labelled checkbox with an off state", () => {
    render(<Checkbox aria-label="Select row" />);

    const control = screen.getByRole("checkbox", { name: "Select row" });
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(control.getAttribute("data-unchecked")).not.toBeNull();
    expect(control.getAttribute("data-checked")).toBeNull();
  });

  it("toggles on click and reports a boolean to the caller", () => {
    const changes: unknown[] = [];
    render(
      <Checkbox
        aria-label="Select row"
        onCheckedChange={(checked) => changes.push(checked)}
      />,
    );
    const control = screen.getByRole("checkbox", { name: "Select row" });

    fireEvent.click(control);

    expect(changes).toEqual([true]);
    expect(typeof changes[0]).toBe("boolean");
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(control.getAttribute("data-checked")).not.toBeNull();
    expect(
      control.querySelector('[data-slot="checkbox-indicator"]'),
    ).not.toBeNull();
  });

  it("toggles with Space", () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox aria-label="Select row" onCheckedChange={onCheckedChange} />,
    );

    pressSpace(screen.getByRole("checkbox", { name: "Select row" }));

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true);
    expect(
      screen
        .getByRole("checkbox", { name: "Select row" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("keeps its indicator mounted while unchecked", () => {
    render(<Checkbox aria-label="Select row" />);

    const control = screen.getByRole("checkbox", { name: "Select row" });
    const indicator = control.querySelector('[data-slot="checkbox-indicator"]');
    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute("data-unchecked")).not.toBeNull();
  });

  it("submits on Enter without toggling, like Base UI", async () => {
    const onSubmit = formSubmitSpy();
    const onCheckedChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Checkbox aria-label="Select row" onCheckedChange={onCheckedChange} />
        <button type="submit">Save</button>
      </form>,
    );
    const control = screen.getByRole("checkbox", { name: "Select row" });
    control.focus();

    fireEvent.keyDown(control, { key: "Enter" });
    fireEvent.keyUp(control, { key: "Enter" });
    // Base UI submits from a microtask after the keydown.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders a mixed state when indeterminate", () => {
    render(<Checkbox aria-label="Select all" indeterminate />);

    const control = screen.getByRole("checkbox", { name: "Select all" });
    expect(control.getAttribute("aria-checked")).toBe("mixed");
    expect(control.getAttribute("data-indeterminate")).not.toBeNull();
    expect(
      control
        .querySelector('[data-slot="checkbox-indicator"] path')
        ?.getAttribute("d"),
    ).toBe("M5.252 12h13.496");
  });

  it("keeps a controlled mixed state until the caller changes it", () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        aria-label="Select all"
        checked={false}
        indeterminate
        onCheckedChange={onCheckedChange}
      />,
    );
    const control = screen.getByRole("checkbox", { name: "Select all" });
    expect(control.getAttribute("aria-checked")).toBe("mixed");

    fireEvent.click(control);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true);
    expect(control.getAttribute("aria-checked")).toBe("mixed");
  });

  it("follows a controlled checked prop", () => {
    const { rerender } = render(
      <Checkbox
        aria-label="Select row"
        checked={false}
        onCheckedChange={() => {}}
      />,
    );
    expect(
      screen
        .getByRole("checkbox", { name: "Select row" })
        .getAttribute("aria-checked"),
    ).toBe("false");

    rerender(
      <Checkbox aria-label="Select row" checked onCheckedChange={() => {}} />,
    );

    expect(
      screen
        .getByRole("checkbox", { name: "Select row" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("does not change while disabled", () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        aria-label="Select row"
        disabled
        onCheckedChange={onCheckedChange}
      />,
    );
    const control = screen.getByRole("checkbox", { name: "Select row" });

    fireEvent.click(control);

    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(control.getAttribute("aria-checked")).toBe("false");
  });

  it("submits its value", () => {
    const submitted: string[] = [];
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          for (const [name, value] of new FormData(event.currentTarget)) {
            submitted.push(`${name}=${value}`);
          }
        }}
      >
        <Checkbox
          aria-label="Newsletter"
          defaultChecked
          name="newsletter"
          value="weekly"
        />
        <Checkbox aria-label="Terms" name="terms" />
        <button type="submit">Save</button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(submitted).toEqual(["newsletter=weekly"]);
  });
});
