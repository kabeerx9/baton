import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { useTaskStatusStore } from "@/store/task-status/store";
import type Task from "@/types/task";
import { useUpdateTaskStatus } from "./use-update-task-status";

vi.mock("@/fetchers/task/update-task-status", () => ({ default: vi.fn() }));
vi.mock("@/lib/notify-change-requested", () => ({
  notifyChangeRequested: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  onlineManager.setOnline(true);
});

const task = (over: Partial<Task> = {}) =>
  ({ id: "t", title: "T", projectId: "p", status: "done", ...over }) as Task;

function setup() {
  const client = new QueryClient();
  const hook = renderHook(useUpdateTaskStatus, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return hook;
}

describe("useUpdateTaskStatus", () => {
  it("resolves with the outcome of its own click", async () => {
    vi.mocked(updateTaskStatus).mockResolvedValue({
      outcome: "applied",
      task: { id: "t", statusGeneration: 4 },
    } as never);
    const hook = setup();
    let result: unknown;
    await act(async () => {
      result = await hook.result.current.mutateAsync(
        task({ statusChange: { move: "apply" } }),
      );
    });
    expect(result).toEqual({ outcome: "applied" });
  });

  it("asks first when the task carries no prediction", async () => {
    const hook = setup();
    await act(async () => {
      void hook.result.current.mutateAsync(task());
    });
    expect(updateTaskStatus).not.toHaveBeenCalled();
    expect(useTaskStatusStore.getState().entries.t?.kind).toBe("confirming");
  });

  it("runs while the browser reports offline, shows the click, then fails it", async () => {
    // The default network mode would pause the mutation and apply it later, unseen.
    onlineManager.setOnline(false);
    vi.mocked(updateTaskStatus).mockRejectedValue(
      new Error("Failed to connect to API server"),
    );
    const hook = setup();
    await act(async () => {
      await hook.result.current
        .mutateAsync(task({ statusChange: { move: "apply" } }))
        .catch(() => undefined);
    });
    expect(updateTaskStatus).toHaveBeenCalledTimes(1);
    expect(useTaskStatusStore.getState().entries.t?.kind).toBe("uncertain");
    onlineManager.setOnline(true);
    await act(async () => undefined);
    expect(updateTaskStatus).toHaveBeenCalledTimes(1);
  });
});
