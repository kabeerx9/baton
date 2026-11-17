import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { HttpError } from "@/lib/http-error";
import { notifyChangeRequested } from "@/lib/notify-change-requested";
import { toast } from "@/lib/toast";
import { useTaskStatusStore } from "@/store/task-status/store";
import { useSetStatus } from "./use-set-status";

vi.mock("@/fetchers/task/update-task-status", () => ({ default: vi.fn() }));
vi.mock("@/lib/notify-change-requested", () => ({
  notifyChangeRequested: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  onlineManager.setOnline(true);
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

const applied = { outcome: "applied", task: { id: "t", statusGeneration: 4 } };

describe("useSetStatus", () => {
  it("shows the server message when a blocked task cannot be finished", async () => {
    const { hook } = setup();
    vi.mocked(updateTaskStatus).mockRejectedValue(
      new HttpError(409, "Waiting on API-3. Finish it first."),
    );
    await act(async () => {
      await hook.result.current
        .mutateAsync({ taskId: "t", status: "done", move: "apply" })
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
        .mutateAsync({ taskId: "t", status: "done", move: "apply" })
        .catch(() => undefined);
    });
    expect(client.getQueryState(["task-board", "w"])?.isInvalidated).toBe(true);
    expect(useTaskStatusStore.getState().entries.t).toBeUndefined();
  });

  it("shows no toast when the change works, and resolves applied", async () => {
    const { hook } = setup();
    vi.mocked(updateTaskStatus).mockResolvedValue(applied as never);
    let result: unknown;
    await act(async () => {
      result = await hook.result.current.mutateAsync({
        taskId: "t",
        status: "doing",
        move: "apply",
      });
    });
    expect(result).toEqual({ outcome: "applied" });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says a request was sent and keeps the shown status after the person confirms", async () => {
    const { hook, client } = setup();
    const task = { id: "t", userId: "neha" };
    vi.mocked(updateTaskStatus).mockResolvedValue({
      outcome: "requested",
      task,
    } as never);
    let pending: Promise<unknown>;
    await act(async () => {
      pending = hook.result.current.mutateAsync({
        taskId: "t",
        status: "done",
        move: "request",
      });
    });
    // Nothing is sent until the modal is confirmed.
    expect(updateTaskStatus).not.toHaveBeenCalled();
    expect(useTaskStatusStore.getState().entries.t?.kind).toBe("confirming");
    const { confirmRequests } =
      await import("@/store/task-status/write-status");
    await act(async () => {
      confirmRequests(client);
      await expect(pending).resolves.toEqual({ outcome: "requested" });
    });
    expect(notifyChangeRequested).toHaveBeenCalledWith(client, task);
    expect(toast.error).not.toHaveBeenCalled();
    // The board reloads from the server, which still has the old status.
    expect(client.getQueryState(["task-board", "w"])?.isInvalidated).toBe(true);
  });

  it("asks before sending when the caller gives no prediction", async () => {
    const { hook } = setup();
    await act(async () => {
      void hook.result.current.mutate({ taskId: "t", status: "done" });
    });
    expect(updateTaskStatus).not.toHaveBeenCalled();
    expect(useTaskStatusStore.getState().entries.t?.kind).toBe("confirming");
  });

  it("runs while the browser reports offline, shows the click, then fails it", async () => {
    // The default network mode would pause the mutation and apply it later, unseen.
    onlineManager.setOnline(false);
    const { hook } = setup();
    vi.mocked(updateTaskStatus).mockRejectedValue(
      new Error("Failed to connect to API server"),
    );
    await act(async () => {
      await hook.result.current
        .mutateAsync({ taskId: "t", status: "done", move: "apply" })
        .catch(() => undefined);
    });
    expect(updateTaskStatus).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalled();
    onlineManager.setOnline(true);
    await act(async () => undefined);
    expect(updateTaskStatus).toHaveBeenCalledTimes(1);
  });
});
