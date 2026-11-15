import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Switch } from "./switch";

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

// Both wrapper versions activate on the Enter keydown themselves, so no native
// click is supplied here.
function pressEnter(element: HTMLElement) {
  fireEvent.keyDown(element, { key: "Enter" });
  fireEvent.keyUp(element, { key: "Enter" });
}

function formSubmitSpy() {
  return vi.fn((event: { preventDefault: () => void }) => {
    event.preventDefault();
  });
}

describe("Switch", () => {
  it("is a labelled switch with an off state", () => {
    render(
      // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- the control is our Switch part, not a native input
      <label>
        Weekly digest
        <Switch />
      </label>,
    );

    const control = screen.getByRole("switch", { name: "Weekly digest" });
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(control.getAttribute("data-unchecked")).not.toBeNull();
    expect(control.getAttribute("data-checked")).toBeNull();
  });

  it("toggles on click and reports a boolean to the caller", () => {
    const changes: unknown[] = [];
    render(
      <Switch
        aria-label="Enabled"
        onCheckedChange={(checked) => changes.push(checked)}
      />,
    );
    const control = screen.getByRole("switch", { name: "Enabled" });

    fireEvent.click(control);

    expect(changes).toEqual([true]);
    expect(typeof changes[0]).toBe("boolean");
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(control.getAttribute("data-checked")).not.toBeNull();
    expect(control.getAttribute("data-unchecked")).toBeNull();
  });

  it("toggles with Space", () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Enabled" onCheckedChange={onCheckedChange} />);

    pressSpace(screen.getByRole("switch", { name: "Enabled" }));

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true);
    expect(
      screen
        .getByRole("switch", { name: "Enabled" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("does not toggle or submit on Enter from the thumb", () => {
    const onSubmit = formSubmitSpy();
    const onCheckedChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Switch aria-label="Enabled" onCheckedChange={onCheckedChange} />
        <button type="submit">Save</button>
      </form>,
    );
    const control = screen.getByRole("switch", { name: "Enabled" });
    const thumb = control.querySelector(
      '[data-slot="switch-thumb"]',
    ) as HTMLElement;

    fireEvent.keyDown(thumb, { key: "Enter" });

    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not toggle or submit on Enter from a focusable child", () => {
    const onSubmit = formSubmitSpy();
    const onCheckedChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Switch
          aria-label="Enabled"
          onCheckedChange={onCheckedChange}
          render={(props) => (
            <div {...props}>
              <button type="button">Details</button>
            </div>
          )}
        />
        <button type="submit">Save</button>
      </form>,
    );
    const control = screen.getByRole("switch", { name: "Enabled" });
    const child = screen.getByRole("button", { name: "Details" });

    fireEvent.keyDown(child, { key: "Enter" });

    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("toggles on Enter without submitting its form", () => {
    const onSubmit = formSubmitSpy();
    const onCheckedChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Switch aria-label="Enabled" onCheckedChange={onCheckedChange} />
        <button type="submit">Save</button>
      </form>,
    );
    const control = screen.getByRole("switch", { name: "Enabled" });
    control.focus();

    pressEnter(control);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true);
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("toggles once with Space in a form and does not submit", () => {
    const onSubmit = formSubmitSpy();
    const onCheckedChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Switch aria-label="Enabled" onCheckedChange={onCheckedChange} />
        <button type="submit">Save</button>
      </form>,
    );
    const control = screen.getByRole("switch", { name: "Enabled" });
    control.focus();

    pressSpace(control);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true);
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("toggles on Enter outside a form", () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Enabled" onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch", { name: "Enabled" });
    control.focus();

    pressEnter(control);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(control.getAttribute("aria-checked")).toBe("true");
  });

  it("follows a controlled checked prop", () => {
    const { rerender } = render(
      <Switch
        aria-label="Enabled"
        checked={false}
        onCheckedChange={() => {}}
      />,
    );
    expect(
      screen
        .getByRole("switch", { name: "Enabled" })
        .getAttribute("aria-checked"),
    ).toBe("false");

    rerender(
      <Switch aria-label="Enabled" checked onCheckedChange={() => {}} />,
    );

    expect(
      screen
        .getByRole("switch", { name: "Enabled" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("does not change while disabled", () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        aria-label="Enabled"
        disabled
        onCheckedChange={onCheckedChange}
      />,
    );
    const control = screen.getByRole("switch", { name: "Enabled" });

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
        <Switch
          aria-label="Digest"
          defaultChecked
          name="digest"
          value="weekly"
        />
        <Switch aria-label="Alerts" name="alerts" />
        <button type="submit">Save</button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(submitted).toEqual(["digest=weekly"]);
  });
});

// A control is out of the Tab order when the wrapper marks it natively disabled
// or removes it from the sequence. Base UI used `tabindex="-1"` on a span; UI
// SDK uses a native disabled button. Both must count as skipped.
function skippedByTab(element: HTMLElement) {
  return (
    element.hasAttribute("disabled") ||
    element.getAttribute("tabindex") === "-1"
  );
}

describe("Switch disabled parity (passes on the Base UI wrapper)", () => {
  it("keeps a disabled switch out of the Tab order and ignores presses", () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        aria-label="Security alerts"
        disabled
        onCheckedChange={onCheckedChange}
      />,
    );

    const control = screen.getByRole("switch", { name: "Security alerts" });
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).toHaveAttribute("data-disabled");
    expect(skippedByTab(control)).toBe(true);
    // The dimming comes from `data-disabled`, which both wrappers set.
    expect(control.className).toContain("data-disabled:opacity-64");

    fireEvent.click(control);
    fireEvent.keyDown(control, { key: " " });
    fireEvent.keyUp(control, { key: " " });
    fireEvent.keyDown(control, { key: "Enter" });

    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(control).toHaveAttribute("aria-checked", "false");
  });

  it("keeps a disabled switch out of a submitted form", () => {
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
        <Switch
          aria-label="Alerts"
          defaultChecked
          disabled
          name="alerts"
          value="on"
        />
        <button type="submit">Save</button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(submitted).toEqual([]);
  });
});
