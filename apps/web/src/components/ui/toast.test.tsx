import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import { toast } from "@/lib/toast";

const animate = vi.fn();

beforeEach(() => {
  animate.mockReset();
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  render(
    <ToastProvider position="bottom-right">
      <p>app</p>
    </ToastProvider>,
  );
});

afterEach(() => {
  act(() => toastManager.close());
  cleanup();
});

function toasts() {
  return document.querySelectorAll('[data-slot="toast"]');
}

// A closing toast stays mounted until its exit animation ends.
const gone = (text: string) =>
  waitFor(() => expect(screen.queryByText(text)).toBeNull());
const count = (n: number) => waitFor(() => expect(toasts()).toHaveLength(n));

describe("toast adapters", () => {
  it.each(["success", "error", "info", "warning"] as const)(
    "shows a %s toast with its description",
    (variant) => {
      act(() => {
        toast[variant]("Saved", { description: "All changes stored" });
      });

      expect(screen.getByText("Saved")).toBeTruthy();
      expect(screen.getByText("All changes stored")).toBeTruthy();
      expect(toasts()).toHaveLength(1);
      expect(toasts()[0]?.getAttribute("data-type")).toBe(variant);
    },
  );

  it("shows a loading toast", () => {
    act(() => {
      toast.loading("Working");
    });

    expect(toasts()[0]?.getAttribute("data-type")).toBe("loading");
  });

  it("updates one toast for the same id and shakes it", () => {
    act(() => {
      toast.success("Copied");
    });
    expect(animate).not.toHaveBeenCalled();
    act(() => {
      toast.success("Copied");
    });

    expect(screen.getAllByText("Copied")).toHaveLength(1);
    expect(toasts()).toHaveLength(1);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("keeps different variants as separate toasts", () => {
    act(() => {
      toast.success("Copied");
      toast.error("Copied");
    });

    expect(toasts()).toHaveLength(2);
  });

  it("dismisses one toast by id and ignores a missing id", async () => {
    let id = "";
    act(() => {
      id = toast.info("First");
      toast.info("Second");
    });
    act(() => toast.dismiss(undefined));
    expect(toasts()).toHaveLength(2);

    act(() => toast.dismiss(id));

    await gone("First");
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("closes every toast when close has no id", async () => {
    act(() => {
      toast.info("First");
      toast.info("Second");
    });

    act(() => toastManager.close());

    await count(0);
  });

  it("runs the action, then closes the toast", async () => {
    const onClick = vi.fn();
    act(() => {
      toast.success("Archived", { action: { label: "Undo", onClick } });
    });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    await gone("Archived");
  });

  it("renders a custom icon", () => {
    const Icon = ({ className }: { className?: string }) => (
      <svg data-testid="custom-icon" className={className} />
    );
    act(() => {
      toast("Custom", { icon: Icon });
    });

    expect(screen.getByTestId("custom-icon")).toBeTruthy();
  });

  it("names the region and each toast", () => {
    act(() => {
      toast.success("Saved", { description: "All stored" });
    });

    expect(screen.getByRole("region", { name: /notifications/i })).toBeTruthy();
    const root = toasts()[0];
    const labelledBy = root?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? "")?.textContent).toBe(
      "Saved",
    );
  });

  it("renders the action as a focusable native button", () => {
    act(() => {
      toast.info("Archived", { action: { label: "Undo" } });
    });

    const button = screen.getByRole("button", { name: "Undo" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("tabindex")).not.toBe("-1");
    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    // A native button turns Enter and Space into a click unless a handler stops it.
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
  });

  it("dismisses a focused toast with Escape", async () => {
    act(() => {
      toast.info("Escape me");
    });
    const root = toasts()[0] as HTMLElement;
    act(() => root.focus());

    fireEvent.keyDown(document.activeElement ?? root, { key: "Escape" });

    await gone("Escape me");
  });

  it("moves focus into the toasts with F6", () => {
    const before = document.createElement("button");
    document.body.append(before);
    before.focus();
    act(() => {
      toast.info("Reach me");
    });

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "F6" });
    const region = screen.getByRole("region", { name: /notifications/i });
    expect(region.contains(document.activeElement)).toBe(true);

    before.remove();
  });

  it("closes a toast after its timeout", async () => {
    vi.useFakeTimers();
    try {
      act(() => {
        toast.info("Timed");
      });
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(toasts()).toHaveLength(1);
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    } finally {
      vi.useRealTimers();
    }

    // The live region keeps the text while timers are frozen, so count toasts.
    await count(0);
  });

  // UI SDK only: Base UI did not return focus when the last toast closed.
  it("returns focus to where it came from when the last toast closes", async () => {
    const before = document.createElement("button");
    document.body.append(before);
    before.focus();
    act(() => {
      toast.info("Reach me");
    });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "F6" });
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await gone("Reach me");
    expect(document.activeElement).toBe(before);
    before.remove();
  });
});
