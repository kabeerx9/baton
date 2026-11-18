import { describe, expect, it } from "vite-plus/test";
import { permits } from "./permits";

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
