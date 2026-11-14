import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Checkbox } from "./checkbox";
import { CheckboxGroup } from "./checkbox-group";

function Projects({
  value,
  defaultValue,
  onValueChange,
  disabled,
}: {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <CheckboxGroup
      aria-label="Projects"
      defaultValue={defaultValue}
      disabled={disabled}
      onValueChange={onValueChange}
      value={value}
    >
      <Checkbox value="alpha" />
      <Checkbox value="beta" />
    </CheckboxGroup>
  );
}

describe("CheckboxGroup", () => {
  it("is a named group of checkboxes", () => {
    render(<Projects value={["alpha"]} onValueChange={() => {}} />);

    expect(screen.getByRole("group", { name: "Projects" })).toBeTruthy();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    expect(boxes[0]?.getAttribute("aria-checked")).toBe("true");
    expect(boxes[1]?.getAttribute("aria-checked")).toBe("false");
  });

  it("adds and removes a checkbox value", () => {
    const onValueChange = vi.fn();
    render(<Projects defaultValue={["alpha"]} onValueChange={onValueChange} />);
    const [alpha] = screen.getAllByRole("checkbox");

    fireEvent.click(alpha as HTMLElement);
    expect(onValueChange).toHaveBeenLastCalledWith([], expect.anything());

    onValueChange.mockClear();
    fireEvent.click(alpha as HTMLElement);
    expect(onValueChange).toHaveBeenLastCalledWith(
      ["alpha"],
      expect.anything(),
    );
  });

  it("follows a controlled value", () => {
    const { rerender } = render(
      <Projects value={[]} onValueChange={() => {}} />,
    );
    expect(
      screen.getAllByRole("checkbox")[0]?.getAttribute("aria-checked"),
    ).toBe("false");

    rerender(<Projects value={["alpha", "beta"]} onValueChange={() => {}} />);

    expect(
      screen.getAllByRole("checkbox")[0]?.getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getAllByRole("checkbox")[1]?.getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("does not change while disabled", () => {
    const onValueChange = vi.fn();
    render(<Projects disabled value={[]} onValueChange={onValueChange} />);

    fireEvent.click(screen.getAllByRole("checkbox")[0] as HTMLElement);

    expect(onValueChange).not.toHaveBeenCalled();
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

describe("CheckboxGroup disabled parity (passes on the Base UI wrapper)", () => {
  it("disables every checkbox inside a disabled group", () => {
    const onValueChange = vi.fn();
    render(
      <CheckboxGroup
        aria-label="Projects"
        disabled
        onValueChange={onValueChange}
      >
        <Checkbox aria-label="Alpha" value="alpha" />
        <Checkbox aria-label="Beta" value="beta" />
      </CheckboxGroup>,
    );

    const group = screen.getByRole("group", { name: "Projects" });
    expect(group).toHaveAttribute("data-disabled");

    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toHaveAttribute("aria-disabled", "true");
      expect(checkbox).toHaveAttribute("data-disabled");
      expect(skippedByTab(checkbox)).toBe(true);
      expect(checkbox.className).toContain("data-disabled:opacity-64");
      fireEvent.click(checkbox);
    }

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
