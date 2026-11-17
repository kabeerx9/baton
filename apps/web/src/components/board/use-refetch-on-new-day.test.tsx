import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { useRefetchOnNewDay } from "./use-refetch-on-new-day";

function setup(day: number) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const hook = renderHook(({ day }) => useRefetchOnNewDay(day), {
    initialProps: { day },
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { hook, invalidate };
}

describe("useRefetchOnNewDay", () => {
  it("does nothing on mount or while the day stays the same", () => {
    const { hook, invalidate } = setup(1);
    hook.rerender({ day: 1 });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("refetches every board read, once, when the local day changes", () => {
    const { hook, invalidate } = setup(1);
    hook.rerender({ day: 2 });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["task-board"] });
    hook.rerender({ day: 2 });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
