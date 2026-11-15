import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vite-plus/test";
import { Checkbox } from "./checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";
import { Input } from "./input";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "./number-field";
import { Label } from "./label";
import { Radio, RadioGroup } from "./radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Switch } from "./switch";

// Every control that Baton puts inside a Field. `target` is the element that
// must carry the field's name, description, and aria-invalid. `focusOnLabel`
// says whether pressing the label moves focus to it (text controls and select)
// or toggles it (switch, checkbox). A radio group takes the label as its name.
type Case = {
  name: string;
  control: React.ReactNode;
  target: () => HTMLElement;
  role: string;
  label: "focus" | "toggle" | "name-only";
};

const CASES: Case[] = [
  {
    name: "Input",
    control: <Input name="x" />,
    role: "textbox",
    target: () => screen.getByRole("textbox"),
    label: "focus",
  },
  {
    name: "NumberInput",
    control: (
      <NumberField defaultValue={2} name="x">
        <NumberFieldGroup>
          <NumberFieldDecrement aria-label="Decrease" />
          <NumberFieldInput />
          <NumberFieldIncrement aria-label="Increase" />
        </NumberFieldGroup>
      </NumberField>
    ),
    role: "",
    target: () => screen.getByLabelText<HTMLInputElement>("Label"),
    label: "focus",
  },
  {
    name: "Select",
    control: (
      <Select defaultValue="a" name="x">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
      </Select>
    ),
    role: "combobox",
    target: () => screen.getByRole("combobox"),
    label: "focus",
  },
  {
    name: "Switch",
    control: <Switch name="x" />,
    role: "switch",
    target: () => screen.getByRole("switch"),
    label: "toggle",
  },
  {
    name: "Checkbox",
    control: <Checkbox name="x" />,
    role: "checkbox",
    target: () => screen.getByRole("checkbox"),
    label: "toggle",
  },
  {
    name: "RadioGroup",
    control: (
      <RadioGroup name="x">
        <Label>
          <Radio value="a" />
          Alpha
        </Label>
        <Label>
          <Radio value="b" />
          Beta
        </Label>
      </RadioGroup>
    ),
    role: "radiogroup",
    target: () => screen.getByRole("radiogroup"),
    label: "name-only",
  },
];

function renderField(
  control: React.ReactNode,
  options: { invalid?: boolean; error?: boolean; disabled?: boolean } = {},
) {
  return render(
    <Field disabled={options.disabled} invalid={options.invalid}>
      <FieldLabel>Label</FieldLabel>
      {control}
      <FieldDescription>Help text</FieldDescription>
      {options.error ? <FieldError match>Bad value</FieldError> : null}
    </Field>,
  );
}

// A browser focuses the control on a label press. jsdom does not, so the label
// counts as working when the browser would do it: the native label points at
// the control, or the press moved focus there.
function linksToControl(label: HTMLElement, target: HTMLElement) {
  const native = label.closest("label") as HTMLLabelElement | null;
  return native?.control === target || document.activeElement === target;
}

// UI SDK binds a field's parts after mount and then points the control at the
// ids the parts really have. A browser user never sees the step before it.
async function settled() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

function ids(value: string | null) {
  return (value ?? "").split(/\s+/).filter(Boolean);
}

describe.each(CASES)("Field with $name", (item) => {
  it("names the control from the label", async () => {
    renderField(item.control);
    await settled();

    expect(item.target().getAttribute("aria-labelledby") ?? "").not.toBe("");
    const labelled = screen.getByLabelText("Label", { selector: "*" });
    expect(labelled).toBe(item.target());
  });

  it("describes the control with the description", async () => {
    renderField(item.control);
    await settled();

    const description = screen.getByText("Help text");
    expect(description.id).not.toBe("");
    expect(ids(item.target().getAttribute("aria-describedby"))).toContain(
      description.id,
    );
  });

  it("pressing the label focuses or toggles the control", async () => {
    renderField(item.control);
    await settled();
    const target = item.target();
    const label = screen.getByText("Label");

    fireEvent.click(label);

    if (item.label === "focus") {
      expect(linksToControl(label, target)).toBe(true);
    } else if (item.label === "toggle") {
      const on =
        target.getAttribute("aria-checked") === "true" ||
        (target as HTMLInputElement).checked === true;
      expect(on).toBe(true);
    } else {
      expect(target.getAttribute("aria-labelledby") ?? "").toContain(label.id);
    }
  });

  it("marks the control invalid and links the error", async () => {
    renderField(item.control, { error: true, invalid: true });
    await settled();
    const target = item.target();
    const error = screen.getByText("Bad value");

    expect(error.id).not.toBe("");
    expect(ids(target.getAttribute("aria-describedby"))).toContain(error.id);
    // The wrapper styles read aria-invalid on the control, or on each radio.
    const invalid = [target, ...target.querySelectorAll("[role=radio]")].some(
      (element) => element.getAttribute("aria-invalid") === "true",
    );
    expect(invalid).toBe(true);
    expect(error.className).toContain("text-destructive-foreground");
  });

  it("is not invalid until the field says so", async () => {
    renderField(item.control, { error: true, invalid: false });
    await settled();

    expect(item.target().getAttribute("aria-invalid")).not.toBe("true");
  });

  it("a disabled field disables the control", async () => {
    renderField(item.control, { disabled: true });
    await settled();
    const target = item.target();

    const disabled =
      (target as HTMLInputElement).disabled === true ||
      target.hasAttribute("data-disabled") ||
      target.getAttribute("aria-disabled") === "true";
    expect(disabled).toBe(true);
  });
});

describe("Field with an explicit label and control id", () => {
  it("keeps the label linked when the call site passes htmlFor and id", async () => {
    render(
      <Field>
        <FieldLabel htmlFor="user-name">Name</FieldLabel>
        <Input id="user-name" name="name" />
      </Field>,
    );
    await settled();
    const input = screen.getByRole("textbox", { name: "Name" });

    expect(input.id).toBe("user-name");
    expect(linksToControl(screen.getByText("Name"), input)).toBe(true);
  });

  it("keeps a select trigger linked to its htmlFor label", async () => {
    render(
      <Field>
        <FieldLabel htmlFor="role-select">Role</FieldLabel>
        <Select defaultValue="a">
          <SelectTrigger id="role-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Alpha</SelectItem>
          </SelectContent>
        </Select>
      </Field>,
    );
    await settled();

    const trigger = screen.getByRole("combobox", { name: /Role/ });
    expect(trigger.id).toBe("role-select");
  });

  it("shows a forced error even when the browser considers the value valid", async () => {
    render(
      <Field invalid>
        <FieldLabel htmlFor="n">Name</FieldLabel>
        <Input id="n" name="name" />
        <FieldError match>Name is required</FieldError>
      </Field>,
    );
    await settled();

    expect(screen.getByText("Name is required")).toBeTruthy();
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });
});

describe("Field part slots", () => {
  it("keeps the slot names the styles use", async () => {
    const { container } = renderField(<Input name="x" />, {
      error: true,
      invalid: true,
    });
    await settled();

    expect(container.querySelector("[data-slot=field]")).not.toBeNull();
    expect(container.querySelector("[data-slot=field-label]")).not.toBeNull();
    expect(
      container.querySelector("[data-slot=field-description]"),
    ).not.toBeNull();
    expect(container.querySelector("[data-slot=field-error]")).not.toBeNull();
  });
});
