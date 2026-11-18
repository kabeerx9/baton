import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import useWorkspaceCreationAccess from "./use-workspace-creation-access";

const { getCurrentUser, useCurrentUser, useGetConfig } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  useCurrentUser: vi.fn(),
  useGetConfig: vi.fn(),
}));

vi.mock("@/fetchers/user/get-current-user", () => ({ getCurrentUser }));

vi.mock("@/hooks/queries/user/use-current-user", () => ({ useCurrentUser }));

vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: useGetConfig,
}));

describe("useWorkspaceCreationAccess", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    useCurrentUser.mockReset();
    useGetConfig.mockReset();
    useGetConfig.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
  });

  it("does not restrict a refreshed multi-role user that includes admin", async () => {
    useCurrentUser.mockReturnValue({ data: { role: "user" } });
    getCurrentUser.mockResolvedValue({ role: "user,admin" });

    const { result } = renderHook(() => useWorkspaceCreationAccess());

    await waitFor(() => expect(result.current.isDecided).toBe(true));
    expect(result.current.isCreationRestricted).toBe(false);
    expect(result.current.canCreateWorkspace).toBe(true);
  });

  it("restricts a refreshed non-admin when creation is disabled", async () => {
    useCurrentUser.mockReturnValue({ data: { role: "user" } });
    getCurrentUser.mockResolvedValue({ role: "user" });

    const { result } = renderHook(() => useWorkspaceCreationAccess());

    await waitFor(() => expect(result.current.isDecided).toBe(true));
    expect(result.current.isCreationRestricted).toBe(true);
    expect(result.current.canCreateWorkspace).toBe(false);
  });

  it("falls back to the cached multi-role admin when the refresh fails", async () => {
    useCurrentUser.mockReturnValue({ data: { role: "user,admin" } });
    getCurrentUser.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useWorkspaceCreationAccess());

    await waitFor(() => expect(result.current.isDecided).toBe(true));
    expect(result.current.isCreationRestricted).toBe(false);
    expect(result.current.canCreateWorkspace).toBe(true);
  });
});
