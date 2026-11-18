import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";

const mocks = vi.hoisted(() => ({ getWorkspace: vi.fn() }));

vi.mock("@/fetchers/workspace/get-workspace", () => ({
  default: mocks.getWorkspace,
}));
vi.mock("@/components/common/layout", () => ({ default: () => null }));
vi.mock("@/components/common/workspace-archived", () => ({
  default: () => null,
}));

import { Route } from "./$workspaceId";

const KEY = "baton:last-workspace:u1";

const enter = (preload = false) =>
  (Route.options.beforeLoad as (args: unknown) => Promise<unknown>)({
    params: { workspaceId: "B" },
    preload,
    context: {
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
      session: { user: { id: "u1" } },
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe("workspace route entry", () => {
  it("reads the URL workspace itself before anything renders", async () => {
    mocks.getWorkspace.mockResolvedValue({ id: "B", role: "member" });
    await enter();
    expect(mocks.getWorkspace).toHaveBeenCalledWith("B");
  });

  it("renders nothing under it when the read fails", async () => {
    mocks.getWorkspace.mockRejectedValue(new HttpError(500, "boom"));
    await expect(enter()).rejects.toBeInstanceOf(Error);
  });

  it("lets an archived workspace through to its archived screen", async () => {
    mocks.getWorkspace.mockRejectedValue(
      new HttpError(403, "archived", { code: "WORKSPACE_ARCHIVED" }),
    );
    await expect(enter()).resolves.toBeUndefined();
  });

  it("redirects a non-member to /dashboard and forgets the id", async () => {
    sessionStorage.setItem(KEY, "B");
    localStorage.setItem(KEY, "B");
    mocks.getWorkspace.mockRejectedValue(new HttpError(404, "gone"));
    await expect(enter()).rejects.toMatchObject({
      options: { to: "/dashboard" },
    });
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("sends a non-member instance admin to /dashboard", async () => {
    mocks.getWorkspace.mockResolvedValue({ id: "B", role: null });
    await expect(enter()).rejects.toMatchObject({
      options: { to: "/dashboard" },
    });
  });

  it("writes no storage during a hover preload", async () => {
    sessionStorage.setItem(KEY, "B");
    mocks.getWorkspace.mockRejectedValue(new HttpError(403, "no"));
    await expect(enter(true)).rejects.toMatchObject({
      options: { to: "/dashboard" },
    });
    expect(sessionStorage.getItem(KEY)).toBe("B");
  });
});
