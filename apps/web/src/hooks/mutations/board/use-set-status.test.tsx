import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { HttpError } from "@/lib/http-error";
import { toast } from "@/lib/toast";
import { useSetStatus } from "./use-set-status";

vi.mock("@/fetchers/task/update-task-status", () => ({ default: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const client = new QueryClient();
  client.setQueryData(["task-board", "w"], []);
  const hook = renderHook(useSetStatus, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { hook, client };
}

describe("useSetStatus", () => {
  it("shows the server message when a blocked task cannot be finished", async () => {
    const { hook } = setup();
    vi.mocked(updateTaskStatus).mockRejectedValue(
      new HttpError(409, "Waiting on API-3. Finish it first."),
    );
    await act(async () => {
      await hook.result.current
        .mutateAsync({ taskId: "t", status: "done" })
        .catch(() => undefined);
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Waiting on API-3. Finish it first.",
    );
  });

  it("marks the board stale after a refusal, so the shown status is the server's", async () => {
    const { hook, client } = setup();
    vi.mocked(updateTaskStatus).mockRejectedValue(new HttpError(409, "no"));
    await act(async () => {
      await hook.result.current
        .mutateAsync({ taskId: "t", status: "done" })
        .catch(() => undefined);
    });
    expect(client.getQueryState(["task-board", "w"])?.isInvalidated).toBe(true);
  });

  it("shows no toast when the change works", async () => {
    const { hook } = setup();
    vi.mocked(updateTaskStatus).mockResolvedValue({} as never);
    await act(async () => {
      await hook.result.current.mutateAsync({ taskId: "t", status: "doing" });
    });
    expect(toast.error).not.toHaveBeenCalled();
  });
});
