import { describe, expect, it } from "vite-plus/test";
import { taskPlacement } from "./task-placement";

describe("taskPlacement", () => {
  it("allows a board-project task with or without a parent", () => {
    expect(taskPlacement({ projectKind: "board", hasParent: false })).toBe(
      "ok",
    );
    expect(taskPlacement({ projectKind: "board", hasParent: true })).toBe("ok");
  });

  it("allows a repo task only under a feature", () => {
    expect(taskPlacement({ projectKind: "repo", hasParent: true })).toBe("ok");
    expect(taskPlacement({ projectKind: "repo", hasParent: false })).toBe(
      "needs-parent",
    );
  });

  it("refuses an unknown or missing project kind", () => {
    for (const projectKind of ["calendar", "", null, undefined])
      for (const hasParent of [true, false])
        expect(taskPlacement({ projectKind, hasParent })).toBe("needs-parent");
  });
});
