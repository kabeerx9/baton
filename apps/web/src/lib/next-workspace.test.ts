import { describe, expect, it } from "vite-plus/test";
import { chooseNextWorkspace, resolveLeaveTarget } from "./next-workspace";

const a = { id: "a", kind: "team" };
const b = { id: "b", kind: "team" };
const demo = { id: "d", kind: "demo" };

describe("chooseNextWorkspace", () => {
  it("returns the first remaining non-demo workspace", () => {
    expect(chooseNextWorkspace([a, b], "a")).toBe(b);
    expect(chooseNextWorkspace([demo, a, b], "x")).toBe(a);
  });
  it("returns undefined when nothing remains", () => {
    expect(chooseNextWorkspace([a], "a")).toBeUndefined();
    expect(chooseNextWorkspace([demo], "a")).toBeUndefined();
    expect(chooseNextWorkspace(undefined, "a")).toBeUndefined();
  });
});

describe("resolveLeaveTarget", () => {
  it("is loading only while the list is unknown", () => {
    expect(
      resolveLeaveTarget({ activeId: "a", workspaces: undefined }),
    ).toEqual({ kind: "loading" });
  });
  it("prefers the active workspace", () => {
    expect(resolveLeaveTarget({ activeId: "b", workspaces: [a, b] })).toEqual({
      kind: "workspace",
      workspaceId: "b",
    });
  });
  it("falls back to the first workspace when there is no active one", () => {
    expect(
      resolveLeaveTarget({ activeId: undefined, workspaces: [a, b] }),
    ).toEqual({ kind: "workspace", workspaceId: "a" });
  });
  it("does not trust an active workspace missing from the list", () => {
    expect(resolveLeaveTarget({ activeId: "gone", workspaces: [b] })).toEqual({
      kind: "workspace",
      workspaceId: "b",
    });
  });
  it("falls back to onboarding when no workspace remains", () => {
    expect(resolveLeaveTarget({ activeId: "gone", workspaces: [] })).toEqual({
      kind: "onboarding",
    });
    expect(resolveLeaveTarget({ activeId: "d", workspaces: [demo] })).toEqual({
      kind: "onboarding",
    });
  });
});
