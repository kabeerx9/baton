import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Checkbox } from "./checkbox";
import { CheckboxGroup } from "./checkbox-group";
import { Field, FieldError } from "./field";
import { Fieldset, FieldsetLegend } from "./fieldset";
import { Input } from "./input";
import { Label } from "./label";
import { Radio, RadioGroup } from "./radio-group";

async function settled() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe("Fieldset", () => {
  it("is a group named by its legend, with the stable slot names", async () => {
    const { container } = render(
      <Fieldset>
        <FieldsetLegend>Address</FieldsetLegend>
        <Input aria-label="Street" />
      </Fieldset>,
    );
    await settled();

    const group = screen.getByRole("group", { name: "Address" });
    expect(group.tagName).toBe("FIELDSET");
    expect(group.getAttribute("data-slot")).toBe("field-set");
    expect(container.querySelector("[data-slot=field-legend]")).not.toBeNull();
  });

  it("disables the controls inside it", async () => {
    render(
      <form aria-label="Form">
        <Fieldset disabled>
          <FieldsetLegend>Address</FieldsetLegend>
          <Input aria-label="Street" defaultValue="x" name="street" />
        </Fieldset>
      </form>,
    );
    await settled();
    const input = screen.getByLabelText<HTMLInputElement>("Street");

    // A native fieldset disables its controls, so they are unfocusable and
    // missing from the form data.
    expect(input.matches(":disabled")).toBe(true);
    expect(
      new FormData(screen.getByRole<HTMLFormElement>("form")).has("street"),
    ).toBe(false);
  });

  it("renders as a radio group that its legend names", async () => {
    const changes: unknown[] = [];
    render(
      <Fieldset
        render={
          <RadioGroup
            defaultValue="all"
            onValueChange={(value) => changes.push(value)}
          />
        }
      >
        <FieldsetLegend>Access</FieldsetLegend>
        <Label>
          <Radio value="all" />
          All projects
        </Label>
        <Label>
          <Radio value="selected" />
          Selected projects
        </Label>
      </Fieldset>,
    );
    await settled();

    expect(screen.getByRole("radiogroup", { name: "Access" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Selected projects" }));
    expect(changes).toEqual(["selected"]);
  });

  it("renders as a checkbox group that its legend names, inside a Field with an error", async () => {
    const changes: unknown[] = [];
    render(
      <Field invalid>
        <Fieldset
          render={
            <CheckboxGroup
              defaultValue={["a"]}
              onValueChange={(value) => changes.push(value)}
            />
          }
        >
          <FieldsetLegend className="sr-only">Projects</FieldsetLegend>
          <Label>
            <Checkbox value="a" />
            Alpha
          </Label>
          <Label>
            <Checkbox value="b" />
            Beta
          </Label>
        </Fieldset>
        <FieldError match>Pick one</FieldError>
      </Field>,
    );
    await settled();

    expect(screen.getByRole("group", { name: "Projects" })).toBeTruthy();
    expect(screen.getByText("Pick one")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Beta" }));
    expect(changes).toEqual([["a", "b"]]);
  });
});
