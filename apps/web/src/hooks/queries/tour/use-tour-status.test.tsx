import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { refetchWhileFailed, useTourStatus } from "./use-tour-status";

const getTour = vi.hoisted(() => vi.fn());
vi.mock("@/fetchers/tour/get-tour", () => ({ getTour }));

function setup() {
  // Zero delay keeps the test fast; the hook sets `retry`, not the delay.
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useTourStatus(), { wrapper });
}

afterEach(() => vi.clearAllMocks());

describe("useTourStatus", () => {
  it("recovers when the first fetch fails and the second succeeds", async () => {
    getTour
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ completed: false, demoWorkspace: null });
    const { result } = setup();
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.completed).toBe(false));
    expect(getTour).toHaveBeenCalledTimes(2);
  });

  it("stays unanswered while every attempt fails", async () => {
    getTour.mockRejectedValue(new Error("down"));
    const { result } = setup();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(getTour).toHaveBeenCalledTimes(4); // first try plus 3 retries
  });
});

describe("refetchWhileFailed", () => {
  const query = (status: string) =>
    ({ state: { status } }) as unknown as Parameters<
      typeof refetchWhileFailed
    >[0];

  it("refetches an errored query only", () => {
    expect(refetchWhileFailed(query("error"))).toBe(true);
    expect(refetchWhileFailed(query("success"))).toBe(false);
    expect(refetchWhileFailed(query("pending"))).toBe(false);
  });
});
