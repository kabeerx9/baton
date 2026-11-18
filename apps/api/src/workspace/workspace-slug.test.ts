import { describe, expect, it } from "vite-plus/test";
import { slugFromName, slugWithSuffix } from "./workspace-slug";

describe("slugFromName", () => {
  it.each([
    ["Acme Corp", "acme-corp"],
    ["  Hello,   World!! ", "hello-world"],
    ["Ünïcode Team", "n-code-team"],
    ["---", "workspace"],
    ["", "workspace"],
    ["a".repeat(60), "a".repeat(48)],
    [`${"a".repeat(47)} b`, "a".repeat(47)],
  ])("%j -> %j", (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
  });
});

describe("slugWithSuffix", () => {
  it("appends six base-36 characters", () => {
    expect(slugWithSuffix("acme", () => 35)).toBe("acme-zzzzzz");
    expect(slugWithSuffix("acme")).toMatch(/^acme-[0-9a-z]{6}$/);
  });
});
