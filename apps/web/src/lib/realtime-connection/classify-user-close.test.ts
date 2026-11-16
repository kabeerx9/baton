import { describe, expect, it } from "vite-plus/test";
import { classifyUserClose } from "./classify-user-close";

describe("classifyUserClose", () => {
  it.each([
    [4001, "check-session"],
    [1008, { end: "user-access-revoked" }],
    [1011, "retry"],
    [1006, "retry"],
    [undefined, "retry"],
  ])("maps close %s", (code, verdict) => {
    expect(classifyUserClose(code)).toEqual(verdict);
  });
});
