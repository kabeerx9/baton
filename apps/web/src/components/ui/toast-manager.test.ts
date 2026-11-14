import { afterEach, expect, it } from "vite-plus/test";
import { toaster, toastManager } from "@/components/ui/toast-manager";

afterEach(() => toastManager.close());

it("shows an unknown type as a default toast", () => {
  const id = toastManager.add({ title: "Hi", type: "mystery" });

  expect(toaster.toasts().find((t) => t.id === id)?.type).toBe("default");
});

it("maps actionProps to an action that runs onClick", () => {
  let clicked = 0;
  const id = toastManager.add({
    title: "Hi",
    actionProps: { children: "Undo", onClick: () => (clicked += 1) },
  });

  const action = toaster.toasts().find((t) => t.id === id)?.action;
  action?.onAction?.(undefined, {} as never);

  expect(action?.label).toBe("Undo");
  expect(clicked).toBe(1);
});

it("updates a showing toast and reports a missing one", () => {
  const id = toastManager.add({ title: "Before" });

  expect(toastManager.update(id, { title: "After" })).toBe(true);
  expect(toaster.toasts().find((t) => t.id === id)?.title).toBe("After");
  toastManager.close(id);
  expect(toastManager.update(id, { title: "Late" })).toBe(false);
});
