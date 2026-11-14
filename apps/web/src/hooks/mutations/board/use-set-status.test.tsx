import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { HttpError } from "@/lib/http-error";
import { notifyChangeRequested } from "@/lib/notify-change-requested";
import { toast } from "@/lib/toast";
import { useSetStatus } from "./use-set-status";

vi.mock("@/fetchers/task/update-task-status", () => ({ default: vi.fn() }));
vi.mock("@/lib/notify-change-requested", () => ({
  notifyChangeRequested: vi.fn(),
}));
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

  it("says a request was sent and keeps the shown status when someone outside the task asks", async () => {
    const { hook, client } = setup();
    const task = { id: "t", userId: "neha" };
    vi.mocked(updateTaskStatus).mockResolvedValue({
      outcome: "requested",
      task,
    } as never);
    await act(async () => {
      await hook.result.current.mutateAsync({ taskId: "t", status: "done" });
    });
    expect(notifyChangeRequested).toHaveBeenCalledWith(client, task);
    expect(toast.error).not.toHaveBeenCalled();
    // The board reloads from the server, which still has the old status.
    expect(client.getQueryState(["task-board", "w"])?.isInvalidated).toBe(true);
  });
});
