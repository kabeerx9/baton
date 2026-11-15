import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Label } from "@/components/ui/label";
import { Radio, RadioGroup, RadioPrimitive } from "@/components/ui/radio-group";

function Choices({
  value,
  onValueChange,
  disabled,
}: {
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      aria-label="Plan"
      disabled={disabled}
      onValueChange={onValueChange}
      value={value}
    >
      <Label>
        <Radio value="starter" />
        Starter
      </Label>
      <Label>
        <Radio value="pro" />
        Pro
      </Label>
      <Label>
        <Radio value="team" />
        Team
      </Label>
    </RadioGroup>
  );
}

function radios() {
  return screen.getAllByRole("radio") as HTMLElement[];
}

describe("RadioGroup", () => {
  it("names the group and each radio", () => {
    render(<Choices />);

    expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Starter" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Pro" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Team" })).toBeInTheDocument();
  });

  it("checks a radio on click and reports its value as a string", () => {
    const onValueChange = vi.fn();
    render(<Choices onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "Pro" }));

    expect(screen.getByRole("radio", { name: "Pro" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Starter" })).not.toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("pro");
    expect(typeof onValueChange.mock.calls[0]?.[0]).toBe("string");
  });

  it("checks a radio when its label is clicked", () => {
    render(<Choices />);

    fireEvent.click(screen.getByText("Team"));

    expect(screen.getByRole("radio", { name: "Team" })).toBeChecked();
  });

  it("follows a controlled value", () => {
    const { rerender } = render(<Choices value="starter" />);
    expect(screen.getByRole("radio", { name: "Starter" })).toBeChecked();

    rerender(<Choices value="team" />);

    expect(screen.getByRole("radio", { name: "Team" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Starter" })).not.toBeChecked();
  });

  it("moves and selects with the arrow keys, wrapping at the ends", async () => {
    const onValueChange = vi.fn();
    render(<Choices onValueChange={onValueChange} />);

    const starter = screen.getByRole("radio", { name: "Starter" });
    starter.focus();
    fireEvent.keyDown(starter, { key: "ArrowDown" });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Pro" })).toBeChecked();
      expect(document.activeElement).toBe(
        screen.getByRole("radio", { name: "Pro" }),
      );
    });

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "ArrowUp",
    });
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Starter" })).toBeChecked();
    });

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "ArrowUp",
    });
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Team" })).toBeChecked();
    });

    expect(onValueChange).toHaveBeenCalledTimes(3);
  });

  it("keeps one tab stop, on the checked radio", () => {
    render(<Choices value="pro" />);

    const tabbable = radios().filter(
      (radio) => radio.getAttribute("tabindex") !== "-1",
    );
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBe(screen.getByRole("radio", { name: "Pro" }));
  });

  it("checks the focused radio with Space", async () => {
    // A radio rendered as a native <button> lets the browser turn Space into a
    // click; jsdom does not run that activation. Render a span instead so the
    // library's own Space handling is what the test exercises.
    render(
      <RadioGroup aria-label="Plan">
        <Radio aria-label="Pro" render={<span />} value="pro" />
      </RadioGroup>,
    );

    const pro = screen.getByRole("radio", { name: "Pro" });
    pro.focus();
    fireEvent.keyDown(pro, { key: " " });
    fireEvent.keyUp(pro, { key: " " });

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Pro" })).toBeChecked(),
    );
  });

  it("skips a disabled radio with the arrow keys", async () => {
    render(
      <RadioGroup aria-label="Plan" defaultValue="starter">
        <Label>
          <Radio value="starter" />
          Starter
        </Label>
        <Label>
          <Radio disabled value="pro" />
          Pro
        </Label>
        <Label>
          <Radio value="team" />
          Team
        </Label>
      </RadioGroup>,
    );

    fireEvent.keyDown(screen.getByRole("radio", { name: "Starter" }), {
      key: "ArrowDown",
    });

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Team" })).toBeChecked(),
    );
    expect(screen.getByRole("radio", { name: "Pro" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("disables every radio in a disabled group", () => {
    const onValueChange = vi.fn();
    render(<Choices disabled onValueChange={onValueChange} value="starter" />);

    for (const radio of radios()) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
    }
    fireEvent.click(screen.getByRole("radio", { name: "Team" }));
    expect(screen.getByRole("radio", { name: "Starter" })).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps Enter from submitting the form from the styled Radio", () => {
    const onSubmit = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <RadioGroup aria-label="Plan" defaultValue="starter">
          <Label>
            <Radio onKeyDown={onKeyDown} value="starter" />
            Starter
          </Label>
        </RadioGroup>
        <button type="submit">Save</button>
      </form>,
    );

    const radio = screen.getByRole("radio", { name: "Starter" });
    radio.focus();
    fireEvent.keyDown(radio, { key: "Enter" });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps Enter from submitting the form from RadioPrimitive", () => {
    const onSubmit = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <RadioGroup aria-label="Theme" defaultValue="light">
          <RadioPrimitive aria-label="Light" value="light">
            <span>Light</span>
          </RadioPrimitive>
        </RadioGroup>
        <button type="submit">Save</button>
      </form>,
    );

    const radio = screen.getByRole("radio", { name: "Light" });
    radio.focus();
    fireEvent.keyDown(radio, { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the indicator only on the checked radio", () => {
    const { container } = render(<Choices value="pro" />);

    const indicators = container.querySelectorAll(
      '[data-slot="radio-indicator"]',
    );
    // The indicator unmounts while unchecked.
    expect(indicators).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Pro" })).toContainElement(
      indicators[0] as HTMLElement,
    );
  });

  it("submits the checked value with its form", () => {
    let submitted: string | null = null;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = new FormData(event.currentTarget).get("plan") as
            | string
            | null;
        }}
      >
        <RadioGroup aria-label="Plan" defaultValue="pro" name="plan">
          <Label>
            <Radio value="starter" />
            Starter
          </Label>
          <Label>
            <Radio value="pro" />
            Pro
          </Label>
        </RadioGroup>
        <button type="submit">Save</button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(submitted).toBe("pro");
  });
});

// A control is out of the Tab order when the wrapper marks it natively disabled
// or removes it from the sequence. Base UI and UI SDK both use `tabindex="-1"`
// for a radio that is out of the group's roving sequence.
function skippedByTab(element: HTMLElement) {
  return (
    element.hasAttribute("disabled") ||
    element.getAttribute("tabindex") === "-1"
  );
}

// Both wrappers render a hidden native radio beside the styled control. Base UI
// also gives that input the same accessible name, so pick the control itself.
function radioControl(name: string) {
  return screen
    .getAllByRole("radio", { name })
    .filter((element) => element.tagName !== "INPUT")[0] as HTMLElement;
}

describe("RadioGroup disabled parity (passes on the Base UI wrapper)", () => {
  it("disables every radio inside a disabled group", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        aria-label="Plan"
        defaultValue="starter"
        disabled
        onValueChange={onValueChange}
      >
        <Label>
          <Radio value="starter" />
          Starter
        </Label>
        <Label>
          <Radio value="team" />
          Team
        </Label>
      </RadioGroup>,
    );

    expect(screen.getByRole("radiogroup", { name: "Plan" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    const controls = radios().filter((element) => element.tagName !== "INPUT");
    expect(controls).toHaveLength(2);
    for (const radio of controls) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
      expect(radio).toHaveAttribute("data-disabled");
      expect(radio.className).toContain("data-disabled:opacity-64");
    }

    fireEvent.click(radioControl("Team"));

    expect(radioControl("Starter")).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps one disabled radio out of the Tab order and unselected", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        aria-label="Plan"
        defaultValue="starter"
        onValueChange={onValueChange}
      >
        <Label>
          <Radio value="starter" />
          Starter
        </Label>
        <Label>
          <Radio disabled value="pro" />
          Pro
        </Label>
        <Label>
          <Radio value="team" />
          Team
        </Label>
      </RadioGroup>,
    );

    const pro = radioControl("Pro");
    expect(pro).toHaveAttribute("aria-disabled", "true");
    expect(pro).toHaveAttribute("data-disabled");
    expect(skippedByTab(pro)).toBe(true);

    fireEvent.click(pro);

    expect(pro).not.toBeChecked();
    expect(radioControl("Starter")).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
