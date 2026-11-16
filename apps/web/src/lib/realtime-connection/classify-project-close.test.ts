import { describe, expect, it } from "vite-plus/test";
import { classifyProjectClose } from "./classify-project-close";

describe("classifyProjectClose", () => {
  it.each([
    [4001, "Session ended", "check-session"],
    [1008, "Workspace archived", { end: "workspace-archived" }],
    [1008, "Workspace access revoked", { end: "workspace-access-revoked" }],
    [1008, "Project access revoked", { end: "project-access-revoked" }],
    [1008, "Project workspace changed", "retry"],
    [1008, "toString", "retry"],
    [1008, undefined, "retry"],
    [1006, "", "retry"],
    [1011, "Internal error", "retry"],
    [1000, "Workspace archived", "retry"],
    [undefined, undefined, "retry"],
  ])("maps close %s %s", (code, reason, verdict) => {
    expect(classifyProjectClose(code, reason)).toEqual(verdict);
  });
});
