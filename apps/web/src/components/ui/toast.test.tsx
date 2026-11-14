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
});
