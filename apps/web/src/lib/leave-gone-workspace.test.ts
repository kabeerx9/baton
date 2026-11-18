import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vite-plus/test";
import { leaveGoneWorkspace } from "./leave-gone-workspace";

function setup(options: {
  remaining?: { id: string; kind?: string }[];
  fetchError?: boolean;
  setActiveResult?: unknown;
}) {
  const queryClient = new QueryClient();
  const order: string[] = [];
  const navigate = vi.fn(async (destination: unknown) => {
    order.push("navigate");
    return destination;
  });
  const setActive = vi.fn(async (id: string | null) => {
    order.push(`setActive:${id}`);
    return options.setActiveResult ?? { data: {} };
  });
  const fetchWorkspaces = vi.fn(async () => {
    if (options.fetchError) throw new Error("429");
    return options.remaining ?? [];
  });
  return { queryClient, navigate, setActive, fetchWorkspaces, order };
}

describe("leaveGoneWorkspace", () => {
  it("activates the next workspace before navigating to its board", async () => {
    const t = setup({ remaining: [{ id: "b", kind: "team" }] });
    await leaveGoneWorkspace("a", t);
    expect(t.order).toEqual(["setActive:b", "navigate"]);
    expect(t.navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: "b" },
    });
  });

  it("clears the active workspace and lands on onboarding when none remain", async () => {
    const t = setup({ remaining: [] });
    await leaveGoneWorkspace("a", t);
    expect(t.setActive).toHaveBeenCalledWith(null);
    expect(t.navigate).toHaveBeenCalledWith({ to: "/onboarding" });
  });

  it("never picks the gone or a demo workspace", async () => {
    const t = setup({
      remaining: [
        { id: "a", kind: "team" },
        { id: "d", kind: "demo" },
        { id: "c", kind: "team" },
      ],
    });
    await leaveGoneWorkspace("a", t);
    expect(t.setActive).toHaveBeenCalledWith("c");
  });

  it("falls back to /dashboard when the list cannot be read", async () => {
    const t = setup({ fetchError: true });
    await leaveGoneWorkspace("a", t);
    expect(t.setActive).not.toHaveBeenCalled();
    expect(t.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });

  it("falls back to /dashboard when setActive reports an error", async () => {
    const t = setup({
      remaining: [{ id: "b" }],
      setActiveResult: { error: { message: "boom" } },
    });
    await leaveGoneWorkspace("a", t);
    expect(t.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });

  it("evicts the gone workspace's cached data", async () => {
    const t = setup({ remaining: [{ id: "b" }] });
    t.queryClient.setQueryData(
      ["projects", "a"],
      [{ id: "p", workspaceId: "a" }],
    );
    await leaveGoneWorkspace("a", t);
    expect(t.queryClient.getQueryData(["projects", "a"])).toBeUndefined();
  });
});
