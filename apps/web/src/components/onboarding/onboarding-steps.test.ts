import { describe, expect, it } from "vite-plus/test";
import {
  getNextStep,
  getStepProgress,
  ONBOARDING_STEPS,
} from "./onboarding-steps";

describe("onboarding steps", () => {
  it("starts at the fork and ends on ready", () => {
    expect(ONBOARDING_STEPS[0]).toBe("start");
    expect(ONBOARDING_STEPS.at(-1)).toBe("ready");
  });

  it("counts only the three setup steps", () => {
    expect(getStepProgress("start")).toBeNull();
    expect(getStepProgress("ready")).toBeNull();
    expect(getStepProgress("workspace")).toEqual({ current: 1, total: 3 });
    expect(getStepProgress("project")).toEqual({ current: 3, total: 3 });
  });

  it("moves to the next step and stays on ready", () => {
    expect(getNextStep("start")).toBe("workspace");
    expect(getNextStep("project")).toBe("ready");
    expect(getNextStep("ready")).toBe("ready");
  });
});
