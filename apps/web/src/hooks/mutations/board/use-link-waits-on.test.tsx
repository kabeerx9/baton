import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import createTaskRelation from "@/fetchers/task-relation/create-task-relation";
import { toast } from "@/lib/toast";
import { useLinkWaitsOn } from "./use-link-waits-on";

vi.mock("@/fetchers/task-relation/create-task-relation", () => ({
  default: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const client = new QueryClient();
  const refetch = vi.fn().mockResolvedValue([]);
  client.setQueryDefaults(["task-relations", "me"], { queryFn: refetch });
  client.setQueryData(["task-relations", "me"], []);
  const hook = renderHook(useLinkWaitsOn, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { hook, refetch };
}

describe("useLinkWaitsOn", () => {
  it("shows the server's message when a link is rejected", async () => {
    const { hook } = setup();
    vi.mocked(createTaskRelation).mockRejectedValue(
      new Error("That link would make a loop"),
    );
    await act(async () => {
      await hook.result.current.mutateAsync({
        taskId: "me",
        blockerIds: ["x"],
      });
    });
    expect(toast.error).toHaveBeenCalledWith("That link would make a loop");
  });

  it("reloads the relations after a rejection, so nothing stale stays", async () => {
    const { hook, refetch } = setup();
    vi.mocked(createTaskRelation).mockRejectedValue(new Error("no"));
    await act(async () => {
      await hook.result.current.mutateAsync({
        taskId: "me",
        blockerIds: ["x"],
      });
    });
    await vi.waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});
