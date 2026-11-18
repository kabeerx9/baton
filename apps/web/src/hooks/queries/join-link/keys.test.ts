import { describe, expect, it } from "vite-plus/test";
import { joinLinkKey, joinLinkPreviewKey, membersUpdatedKeys } from "./keys";

describe("join-link query keys", () => {
  it("scopes the link to its workspace and the preview to its token", () => {
    expect(joinLinkKey("w1")).toEqual(["join-link", "w1"]);
    expect(joinLinkPreviewKey("t")).toEqual(["join-link-preview", "t"]);
  });

  it("refreshes the members, the caller's role, the link and the list on a member event", () => {
    expect(membersUpdatedKeys("w1")).toEqual([
      ["workspace", "w1"],
      ["workspace-users", "w1"],
      ["workspace-capabilities", "w1"],
      ["join-link", "w1"],
      ["workspaces"],
    ]);
  });
});
