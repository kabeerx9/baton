import { describe, expect, it } from "vite-plus/test";
import { deriveActiveWorkspace } from "./derive-active-workspace";

const a = { id: "a" };
const b = { id: "b" };
const settled = { isPending: false, error: null };

describe("deriveActiveWorkspace", () => {
  it("prefers the workspace in the URL when it is in the list", () => {
    expect(
      deriveActiveWorkspace({
        routeWorkspaceId: "b",
        list: { data: [a, b], ...settled },
        active: { data: a, ...settled },
      }),
    ).toEqual({ status: "ready", workspace: b });
  });
  it("falls back to the active workspace", () => {
    expect(
      deriveActiveWorkspace({
        routeWorkspaceId: undefined,
        list: { data: [a], ...settled },
        active: { data: a, ...settled },
      }),
    ).toEqual({ status: "ready", workspace: a });
  });
  it("is none, not loading, when nothing is active", () => {
    expect(
      deriveActiveWorkspace({
        routeWorkspaceId: undefined,
        list: { data: [a], ...settled },
        active: { data: null, ...settled },
      }),
    ).toEqual({ status: "none" });
  });
  it("is loading while the active read is pending", () => {
    expect(
      deriveActiveWorkspace({
        routeWorkspaceId: undefined,
        list: { data: undefined, isPending: true, error: null },
        active: { data: undefined, isPending: true, error: null },
      }),
    ).toEqual({ status: "loading" });
  });
  it("reports an error when the active read fails", () => {
    const error = new Error("x");
    expect(
      deriveActiveWorkspace({
        routeWorkspaceId: undefined,
        list: { data: [], ...settled },
        active: { data: undefined, isPending: false, error },
      }),
    ).toEqual({ status: "error", error });
  });
});
