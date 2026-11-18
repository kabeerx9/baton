import { describe, expect, it } from "vite-plus/test";
import { workspaceWriteKeys } from "./workspace-query-keys";

describe("workspaceWriteKeys", () => {
  it("covers the list, the workspace, its members, roles and capabilities", () => {
    expect(workspaceWriteKeys("w1")).toEqual([
      ["workspaces"],
      ["workspace", "w1"],
      ["workspace-users", "w1"],
      ["workspace-roles", "w1"],
      ["workspace-capabilities", "w1"],
    ]);
  });
});
