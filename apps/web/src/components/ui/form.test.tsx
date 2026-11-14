import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod/v4";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";

const schema = z.object({ name: z.string().min(1, "Name is required") });

type NameFormProps = {
  childRef?: React.RefObject<HTMLInputElement | null>;
  onChildClick?: () => void;
  controlClassName?: string;
};

function NameForm({ childRef, onChildClick, controlClassName }: NameFormProps) {
  const form = useForm<{ name: string }>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { name: "" },
  });

  return (
    <Form {...form}>
      <form aria-label="Profile" onSubmit={form.handleSubmit(() => {})}>
        <FormField
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl className={controlClassName}>
                <input
                  {...field}
                  onClick={onChildClick}
                  ref={(element) => {
                    if (childRef) childRef.current = element;
                    field.ref(element);
                  }}
                />
              </FormControl>
              <FormDescription>Shown on your profile</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Save</button>
      </form>
    </Form>
  );
}

function nameInput() {
  return screen.getByLabelText("Name") as HTMLInputElement;
}

describe("FormControl", () => {
  it("puts the field id, describedby and invalid state on its child", () => {
    render(<NameForm />);

    const input = nameInput();
    const label = screen.getByText("Name");

    expect(input.id).not.toBe("");
    expect(label).toHaveAttribute("for", input.id);
    expect(input).toHaveAttribute("aria-invalid", "false");

    const description = screen.getByText("Shown on your profile");
    expect(description.id).not.toBe("");
    expect(input).toHaveAttribute("aria-describedby", description.id);
  });

  it("keeps the child's own handlers and ref", () => {
    const childRef = React.createRef<HTMLInputElement>();
    const onChildClick = vi.fn();
    render(<NameForm childRef={childRef} onChildClick={onChildClick} />);

    const input = nameInput();
    fireEvent.click(input);
    expect(onChildClick).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: "Ada" } });
    expect(input).toHaveValue("Ada");

    expect(childRef.current).toBe(input);
  });

  it("adds the message id to describedby and marks the child invalid on error", async () => {
    render(<NameForm />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const message = await screen.findByText("Name is required");
    const input = nameInput();

    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));

    const description = screen.getByText("Shown on your profile");
    expect(message.id).not.toBe("");
    expect(description.id).not.toBe("");
    expect(input.getAttribute("aria-describedby")).toBe(
      `${description.id} ${message.id}`,
    );
    expect(input).toHaveAccessibleDescription(
      "Shown on your profile Name is required",
    );
  });

  it("merges a class name from FormControl with the child's own", () => {
    render(<NameForm controlClassName="control-class" />);

    const input = nameInput();
    expect(input).toHaveClass("control-class");
  });
});
