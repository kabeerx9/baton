import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Textarea } from "./textarea";

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

describe("Textarea", () => {
  it("is a textbox inside a control wrapper with the stable slot names", () => {
    const { container } = render(<Textarea aria-label="Notes" />);
    const textarea = screen.getByRole("textbox", { name: "Notes" });

    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.getAttribute("data-slot")).toBe("textarea");
    expect(textarea.parentElement?.getAttribute("data-slot")).toBe(
      "textarea-control",
    );
    expect(textarea.parentElement?.getAttribute("data-size")).toBe("default");
    expect(
      container.querySelector("[data-slot=textarea-control]"),
    ).not.toBeNull();
  });

  it("runs onChange with the typed text, uncontrolled", () => {
    const seen: string[] = [];
    render(
      <Textarea
        aria-label="Notes"
        defaultValue="one"
        onChange={(event) => seen.push(event.target.value)}
      />,
    );
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
    expect(textarea.value).toBe("one");

    fireEvent.change(textarea, { target: { value: "two" } });

    expect(seen).toEqual(["two"]);
    expect(textarea.value).toBe("two");
  });

  it("stays controlled", () => {
    function Controlled() {
      const [value, setValue] = React.useState("a");
      return (
        <Textarea
          aria-label="Notes"
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          value={value}
        />
      );
    }
    render(<Controlled />);
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");

    fireEvent.change(textarea, { target: { value: "bc" } });

    expect(textarea.value).toBe("BC");
  });

  it("submits its value under its name", () => {
    renderForm(<Textarea aria-label="Notes" defaultValue="hi" name="notes" />);
    const form = screen.getByRole<HTMLFormElement>("form");

    expect(new FormData(form).get("notes")).toBe("hi");
  });

  it("Enter is a newline: the keydown is not prevented and does not submit", () => {
    const onSubmit = renderForm(<Textarea aria-label="Notes" name="notes" />);
    const textarea = screen.getByRole("textbox");

    const proceeds = fireEvent.keyDown(textarea, { key: "Enter" });

    expect(proceeds).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is natively disabled: not focusable, left out of the form", () => {
    renderForm(
      <Textarea aria-label="Notes" defaultValue="x" disabled name="n" />,
    );
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");

    expect(textarea.disabled).toBe(true);
    expect(textarea.getAttribute("aria-disabled")).toBeNull();
    textarea.focus();
    expect(document.activeElement).not.toBe(textarea);
    expect(
      new FormData(screen.getByRole<HTMLFormElement>("form")).has("n"),
    ).toBe(false);
  });

  it("keeps aria-invalid on the textarea for the wrapper's styles", () => {
    render(<Textarea aria-invalid aria-label="Notes" />);

    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("passes native attributes through", () => {
    render(
      <Textarea
        aria-label="Notes"
        maxLength={50}
        placeholder="Write"
        readOnly
        required
        rows={3}
      />,
    );
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");

    expect(textarea.maxLength).toBe(50);
    expect(textarea.placeholder).toBe("Write");
    expect(textarea.readOnly).toBe(true);
    expect(textarea.required).toBe(true);
    expect(textarea.rows).toBe(3);
  });

  it("forwards a ref to the textarea", () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<Textarea aria-label="Notes" ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("textbox"));
  });

  it("applies the wrapper class and the unstyled switch", () => {
    render(
      <>
        <Textarea aria-label="styled" className="extra" />
        <Textarea aria-label="bare" unstyled />
      </>,
    );

    const styled = screen.getByLabelText("styled").parentElement;
    const bare = screen.getByLabelText("bare").parentElement;
    expect(styled?.className).toContain("extra");
    expect(styled?.className).toContain("border-input");
    expect(bare?.className ?? "").not.toContain("border-input");
  });

  it("maps the size names to data-size on the wrapper", () => {
    render(<Textarea aria-label="sm" size="sm" />);

    expect(
      screen.getByLabelText("sm").parentElement?.getAttribute("data-size"),
    ).toBe("sm");
  });
});
