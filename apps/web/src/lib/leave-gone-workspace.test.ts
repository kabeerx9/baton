import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { leaveGoneWorkspace } from "./leave-gone-workspace";

const KEY = "baton:last-workspace:u1";

function setup(options: {
  remaining?: { id: string; kind?: string }[];
  fetchError?: boolean;
}) {
  const queryClient = new QueryClient();
  const navigate = vi.fn(async (destination: unknown) => destination);
  const fetchWorkspaces = vi.fn(async () => {
    if (options.fetchError) throw new Error("429");
    return options.remaining ?? [];
  });
  return { queryClient, navigate, fetchWorkspaces, userId: "u1" };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("leaveGoneWorkspace", () => {
  it("navigates to the next workspace's board", async () => {
    const t = setup({ remaining: [{ id: "b", kind: "team" }] });
    await leaveGoneWorkspace("a", t);
    expect(t.navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: "b" },
    });
  });

  it("forgets the gone workspace so no screen picks it again", async () => {
    sessionStorage.setItem(KEY, "a");
    localStorage.setItem(KEY, "a");
    const t = setup({ remaining: [{ id: "b" }] });
    await leaveGoneWorkspace("a", t);
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps another tab's remembered workspace", async () => {
    localStorage.setItem(KEY, "c");
    const t = setup({ remaining: [{ id: "b" }] });
    await leaveGoneWorkspace("a", t);
    expect(localStorage.getItem(KEY)).toBe("c");
  });

  it("lands on onboarding when none remain", async () => {
    const t = setup({ remaining: [] });
    await leaveGoneWorkspace("a", t);
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
    expect(t.navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: "c" },
    });
  });

  it("falls back to /dashboard when the list cannot be read", async () => {
    const t = setup({ fetchError: true });
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
