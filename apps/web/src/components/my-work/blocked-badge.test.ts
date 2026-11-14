import { describe, expect, it } from "vite-plus/test";
import { blocker } from "@/components/board/test-fixtures";
import { blockedBadge } from "./blocked-badge";

describe("blockedBadge", () => {
  it("is null for a free task", () => {
    expect(blockedBadge({ waitsOn: [], hiddenBlockers: 0 })).toBeNull();
  });

  it("names the first blocker and counts the rest, hidden ones included", () => {
    expect(
      blockedBadge({
        waitsOn: [blocker("APP-15"), blocker("API-2")],
        hiddenBlockers: 2,
      }),
    ).toMatchObject({ firstKey: "APP-15", more: 3, hidden: 2 });
  });

  it("has no key when every blocker is hidden", () => {
    expect(blockedBadge({ waitsOn: [], hiddenBlockers: 1 })).toMatchObject({
      firstKey: null,
      more: 0,
      hidden: 1,
    });
  });
});
