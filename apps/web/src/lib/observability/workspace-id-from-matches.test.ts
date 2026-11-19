import { describe, expect, it } from "vite-plus/test";
import { workspaceIdFromMatches } from "./workspace-id-from-matches";

describe("workspaceIdFromMatches", () => {
  it("returns the workspace id from the deepest match", () => {
    expect(
      workspaceIdFromMatches([
        { params: {} },
        { params: { workspaceId: "ws1" } },
        { params: { workspaceId: "ws1", projectId: "p1" } },
      ]),
    ).toBe("ws1");
  });

  it("returns undefined outside a workspace route", () => {
    expect(workspaceIdFromMatches([{ params: {} }, {}])).toBeUndefined();
    expect(workspaceIdFromMatches([])).toBeUndefined();
  });
});
