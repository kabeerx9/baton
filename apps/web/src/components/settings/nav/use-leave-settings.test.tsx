import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useLeaveSettings } from "./use-leave-settings";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  active: { data: undefined as { id: string } | undefined },
  list: {
    data: undefined as { id: string }[] | undefined,
    isError: false,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => mocks.active,
}));
vi.mock("@/hooks/queries/workspace/use-get-workspaces", () => ({
  default: () => mocks.list,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.active = { data: undefined };
  mocks.list = { data: undefined, isError: false };
});

describe("useLeaveSettings", () => {
  it("is disabled only while the list loads", () => {
    expect(renderHook(() => useLeaveSettings()).result.current).toBeUndefined();
  });

  it("goes to the first workspace when none is active", () => {
    mocks.list = { data: [{ id: "a" }, { id: "b" }], isError: false };
    renderHook(() => useLeaveSettings()).result.current?.();
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: "a" },
    });
  });

  it("goes to onboarding when no workspace exists", () => {
    mocks.list = { data: [], isError: false };
    renderHook(() => useLeaveSettings()).result.current?.();
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/onboarding" });
  });

  it("still leads somewhere when the list read failed", () => {
    mocks.list = { data: undefined, isError: true };
    renderHook(() => useLeaveSettings()).result.current?.();
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });
});
