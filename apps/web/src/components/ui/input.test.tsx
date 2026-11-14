import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import { Input, type InputProps } from "./input";

// jsdom does not run a browser's implicit form submission on Enter. This does
// what the platform does: if the keydown was not prevented, a form with a submit
// button submits. A handler that prevents Enter therefore fails the test.
function pressEnter(element: HTMLElement) {
  const proceeds = fireEvent.keyDown(element, { key: "Enter" });
  fireEvent.keyUp(element, { key: "Enter" });
  const form = (element as HTMLInputElement).form;
  if (proceeds && form) {
    form.requestSubmit();
  }
  return proceeds;
}

function renderForm(control: React.ReactNode) {
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <form aria-label="Test form" onSubmit={onSubmit}>
      {control}
      <button type="submit">Save</button>
    </form>,
  );
  return onSubmit;
}

describe("Input", () => {
  it("is a textbox inside a control wrapper with the stable slot names", () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });

    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("data-slot")).toBe("input");
    const wrapper = input.parentElement;
    expect(wrapper?.getAttribute("data-slot")).toBe("input-control");
    expect(wrapper?.getAttribute("data-size")).toBe("default");
  });

  it("selectors for the wrapper and the input keep matching", () => {
    const { container } = render(<Input aria-label="Name" />);

    expect(container.querySelector("[data-slot=input-control]")).not.toBeNull();
    expect(container.querySelector("[data-slot=input]")).not.toBeNull();
    expect(
      container.querySelector("[data-slot=input-control] [data-slot=input]"),
    ).not.toBeNull();
  });

  it("runs onChange with the typed text, uncontrolled", () => {
    const seen: string[] = [];
    render(
      <Input
        aria-label="Name"
        defaultValue="Ada"
        onChange={(event) => seen.push(event.target.value)}
      />,
    );
    const input = screen.getByRole<HTMLInputElement>("textbox");
    expect(input.value).toBe("Ada");

    fireEvent.change(input, { target: { value: "Grace" } });

    expect(seen).toEqual(["Grace"]);
    expect(input.value).toBe("Grace");
  });

  it("stays controlled", () => {
    function Controlled() {
      const [value, setValue] = React.useState("a");
      return (
        <Input
          aria-label="Name"
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          value={value}
        />
      );
    }
    render(<Controlled />);
    const input = screen.getByRole<HTMLInputElement>("textbox");

    fireEvent.change(input, { target: { value: "bc" } });

    expect(input.value).toBe("BC");
  });

  it("submits its value under its name", () => {
    const onSubmit = renderForm(
      <Input aria-label="Name" defaultValue="Ada" name="name" />,
    );
    const form = screen.getByRole("form");

    expect(new FormData(form as HTMLFormElement).get("name")).toBe("Ada");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Grace" },
    });
    expect(new FormData(form as HTMLFormElement).get("name")).toBe("Grace");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Enter is left to the browser, so the form submits", () => {
    const onSubmit = renderForm(<Input aria-label="Name" name="name" />);

    const proceeds = pressEnter(screen.getByRole("textbox"));

    expect(proceeds).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("the Enter helper can fail: a handler that prevents Enter stops the submit", () => {
    const onSubmit = renderForm(
      <Input
        aria-label="Name"
        name="name"
        onKeyDown={(event) => event.preventDefault()}
      />,
    );

    const proceeds = pressEnter(screen.getByRole("textbox"));

    expect(proceeds).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is natively disabled: not focusable, left out of the form", () => {
    renderForm(<Input aria-label="Name" defaultValue="x" disabled name="n" />);
    const input = screen.getByRole<HTMLInputElement>("textbox");

    expect(input.disabled).toBe(true);
    expect(input.hasAttribute("disabled")).toBe(true);
    expect(input.getAttribute("aria-disabled")).toBeNull();
    input.focus();
    expect(document.activeElement).not.toBe(input);
    expect(
      new FormData(screen.getByRole<HTMLFormElement>("form")).has("n"),
    ).toBe(false);
  });

  it("keeps aria-invalid on the input for the wrapper's has-aria-invalid styles", () => {
    render(<Input aria-invalid aria-label="Name" />);

    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("passes native attributes through", () => {
    render(
      <Input
        aria-label="Name"
        autoComplete="off"
        maxLength={5}
        placeholder="Your name"
        readOnly
        required
        type="email"
      />,
    );
    const input = screen.getByRole<HTMLInputElement>("textbox");

    expect(input.type).toBe("email");
    expect(input.maxLength).toBe(5);
    expect(input.placeholder).toBe("Your name");
    expect(input.readOnly).toBe(true);
    expect(input.required).toBe(true);
    expect(input.getAttribute("autocomplete")).toBe("off");
  });

  it("applies a numeric size to the native size attribute", () => {
    render(<Input aria-label="Name" size={12} />);

    expect(screen.getByRole<HTMLInputElement>("textbox").size).toBe(12);
  });

  it("maps the size names to data-size on the wrapper", () => {
    render(
      <>
        <Input aria-label="sm" size="sm" />
        <Input aria-label="lg" size="lg" />
      </>,
    );

    expect(
      screen.getByLabelText("sm").parentElement?.getAttribute("data-size"),
    ).toBe("sm");
    expect(
      screen.getByLabelText("lg").parentElement?.getAttribute("data-size"),
    ).toBe("lg");
  });

  it("forwards a ref to the input element", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input aria-label="Name" ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("textbox"));
  });

  it("runs focus and blur handlers and keeps focus handling native", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(<Input aria-label="Name" onBlur={onBlur} onFocus={onFocus} />);
    const input = screen.getByRole("textbox");

    input.focus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    input.blur();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("applies the wrapper class and the unstyled switch", () => {
    render(
      <>
        <Input aria-label="styled" className="extra" />
        <Input aria-label="bare" unstyled />
      </>,
    );

    const styled = screen.getByLabelText("styled").parentElement;
    const bare = screen.getByLabelText("bare").parentElement;
    expect(styled?.className).toContain("extra");
    expect(styled?.className).toContain("border-input");
    expect(bare?.className ?? "").not.toContain("border-input");
  });

  it("nativeInput renders a plain input that keeps a slot passed by a parent part", () => {
    const props: InputProps = { "aria-label": "Combo" };
    render(
      <Input
        {...props}
        data-slot="combobox-input"
        nativeInput
        onChange={() => {}}
        value="x"
      />,
    );
    const input = screen.getByRole("textbox");

    expect(input.getAttribute("data-slot")).toBe("combobox-input");
  });
});

// form.tsx clones its single child with an id, aria-describedby and aria-invalid.
describe("Input through FormControl", () => {
  function Profile() {
    const form = useForm<{ name: string }>({ defaultValues: { name: "" } });
    return (
      <Form {...form}>
        <form
          aria-label="Profile"
          onSubmit={form.handleSubmit(() => {
            form.setError("name", { message: "Name is required" });
          })}
        >
          <FormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>Your full name</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <button type="submit">Save</button>
        </form>
      </Form>
    );
  }

  it("gets the label, the description and the error link, and shows the error state", async () => {
    render(<Profile />);
    const input = screen.getByRole("textbox", { name: "Name" });

    expect(input.id).not.toBe("");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.getAttribute("aria-describedby")).toContain("description");

    fireEvent.submit(screen.getByRole("form"));
    const message = await screen.findByText("Name is required");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(message.id);
    fireEvent.change(input, { target: { value: "Ada" } });
    expect((input as HTMLInputElement).value).toBe("Ada");
  });
});
