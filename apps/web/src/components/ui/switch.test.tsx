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
