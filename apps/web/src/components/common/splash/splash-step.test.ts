import { describe, expect, it } from "vite-plus/test";
import { splashLineKey, splashStepForPath } from "./splash-step";

describe("splashStepForPath", () => {
  it.each([
    ["/dashboard", "workspace"],
    ["/dashboard/", "workspace"],
    ["/dashboard/workspace/abc/board", "workspace"],
    ["/live/task/LIVE-142/show-scores", "task"],
    ["/live/task/LIVE-142", "task"],
    ["/dashboard/settings/account", "generic"],
    ["/join/abc", "generic"],
    ["/auth/sign-in", "generic"],
    ["/", "generic"],
  ] as const)("%s is %s", (path, step) => {
    expect(splashStepForPath(path)).toBe(step);
  });
});

describe("splashLineKey", () => {
  it("falls back to the generic line for an unknown step", () => {
    expect(splashLineKey("nonsense" as never)).toBe("common:splash.generic");
    expect(splashLineKey("session")).toBe("common:splash.session");
  });
});
