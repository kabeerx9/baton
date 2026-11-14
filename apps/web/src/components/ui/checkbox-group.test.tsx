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
