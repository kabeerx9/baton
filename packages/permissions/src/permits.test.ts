import { describe, expect, it } from "vite-plus/test";
import { holdsAction, permits } from "./permits";

describe("permits", () => {
  const granted = { task: ["read", "update"], workspace: ["read"] };

  it("allows when every required action is granted", () => {
    expect(permits(granted, { task: ["read", "update"] })).toBe(true);
    expect(permits(granted, {})).toBe(true);
  });

  it("denies a missing action or resource", () => {
    expect(permits(granted, { task: ["delete"] })).toBe(false);
    expect(permits(granted, { label: ["read"] })).toBe(false);
  });

  it("denies a granted resource with no actions list", () => {
    const broken = { task: undefined } as unknown as Record<string, string[]>;
    expect(permits(broken, { task: ["read"] })).toBe(false);
  });

  it("denies an inherited object key as a resource", () => {
    expect(permits(granted, { constructor: [] })).toBe(false);
  });
});

describe("task:update implies task:update_assigned", () => {
  it("grants update_assigned to a holder of update", () => {
    expect(permits({ task: ["update"] }, { task: ["update_assigned"] })).toBe(
      true,
    );
  });

  it("never grants update to a holder of update_assigned only", () => {
    expect(permits({ task: ["update_assigned"] }, { task: ["update"] })).toBe(
      false,
    );
  });

  it("does not imply anything for other resources", () => {
    expect(permits({ label: ["update"] }, { label: ["update_assigned"] })).toBe(
      false,
    );
  });

  it("holdsAction ignores inherited keys", () => {
    expect(holdsAction(["update"], "task", "constructor")).toBe(false);
  });
});
