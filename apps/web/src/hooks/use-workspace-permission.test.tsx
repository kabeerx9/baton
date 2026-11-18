import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { workspaceCapabilities } from "@baton/permissions";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useWorkspacePermission } from "./use-workspace-permission";

type ActiveStub = { id: string; kind?: string; role: string | null };

const { getMyCapabilities, active } = vi.hoisted(() => ({
  getMyCapabilities: vi.fn(),
  active: {
    workspace: { id: "workspace-1", role: "member" } as ActiveStub,
  },
}));

vi.mock("@/fetchers/workspace/get-my-capabilities", () => ({
  default: getMyCapabilities,
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: active.workspace }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useWorkspacePermission", () => {
  beforeEach(() => {
    getMyCapabilities.mockReset();
    active.workspace = { id: "workspace-1", role: "member" };
  });

  it("hides every delete action in a demo workspace, even for an owner", async () => {
    // The role grants everything; the demo workspace still hides deletes.
    getMyCapabilities.mockResolvedValue(
      Object.fromEntries(
        Object.keys(workspaceCapabilities).map((name) => [name, true]),
      ),
    );
    active.workspace = { id: "demo-1", kind: "demo", role: "owner" };

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(result.current.isCheckingPermissions).toBe(false);
    });

    expect(result.current.canDeleteTasks()).toBe(false);
    expect(result.current.canDeleteProjects()).toBe(false);
    expect(result.current.canDeleteWorkspace()).toBe(false);
    // Everything else still works, so the tour can move tasks.
    expect(result.current.canUpdateTasks()).toBe(true);
  });

  it("keeps delete actions in a team workspace", async () => {
    getMyCapabilities.mockResolvedValue(
      Object.fromEntries(
        Object.keys(workspaceCapabilities).map((name) => [name, true]),
      ),
    );
    active.workspace = { id: "team-1", kind: "team", role: "owner" };

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(result.current.isCheckingPermissions).toBe(false);
    });

    expect(result.current.canDeleteTasks()).toBe(true);
    expect(result.current.canDeleteWorkspace()).toBe(true);
  });

  it("keeps update capabilities independent from delete capabilities", async () => {
    const granted = {
      task: new Set(["create", "read", "update"]),
      label: new Set(["create", "read", "update"]),
    } as Record<string, Set<string>>;

    getMyCapabilities.mockResolvedValue(
      Object.fromEntries(
        Object.entries(workspaceCapabilities).map(([name, permissions]) => [
          name,
          Object.entries(
            permissions as Record<string, readonly string[]>,
          ).every(([resource, actions]) =>
            actions.every((action) => granted[resource]?.has(action)),
          ),
        ]),
      ),
    );

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isCheckingPermissions).toBe(false);
    });

    expect(result.current.canCreateTasks()).toBe(true);
    expect(result.current.canUpdateTasks()).toBe(true);
    expect(result.current.canDeleteTasks()).toBe(false);
    expect(result.current.canCreateLabels()).toBe(true);
    expect(result.current.canUpdateLabels()).toBe(true);
    expect(result.current.canDeleteLabels()).toBe(false);
  });

  it("loads every capability in a single request", async () => {
    getMyCapabilities.mockResolvedValue({});

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isCheckingPermissions).toBe(false);
    });

    expect(getMyCapabilities).toHaveBeenCalledTimes(1);
    expect(getMyCapabilities).toHaveBeenCalledWith("workspace-1");
  });

  it("reads the caller's role from the workspace read, not a member list", async () => {
    getMyCapabilities.mockResolvedValue({});
    active.workspace = { id: "workspace-1", role: "viewer" };

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    expect(result.current.role).toBe("viewer");
    expect(result.current.isOwner).toBe(false);
  });

  it("checks nothing for an instance admin who is not a member", () => {
    active.workspace = { id: "workspace-1", role: null };

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isCheckingPermissions).toBe(false);
    expect(getMyCapabilities).not.toHaveBeenCalled();
  });

  it("stops checking and denies everything when the request fails", async () => {
    getMyCapabilities.mockRejectedValue(new Error("Too many requests"));

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isCheckingPermissions).toBe(false);
    });

    expect(result.current.canCreateTasks()).toBe(false);
    expect(result.current.canManageWorkspace()).toBe(false);
  });
});
