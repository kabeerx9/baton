import { describe, expect, it } from "vite-plus/test";
import {
  eachPermission,
  isDefaultRoleName,
  normalizeRoleName,
  RESERVED_ROLE_NAMES,
  unknownPermissions,
} from "./role-rules";

describe("role rules", () => {
  it("reserves owner and the seeded roles", () => {
    expect(RESERVED_ROLE_NAMES).toEqual(["owner", "viewer", "member", "admin"]);
    expect(isDefaultRoleName("viewer")).toBe(true);
    expect(isDefaultRoleName("owner")).toBe(false);
  });

  it("stores names lower case and trimmed", () => {
    expect(normalizeRoleName("  Reviewer ")).toBe("reviewer");
  });

  it("names unknown resources and actions", () => {
    expect(
      unknownPermissions({ task: ["read", "fly"], spaceship: ["launch"] }),
    ).toEqual(["task:fly", "spaceship:*"]);
    expect(unknownPermissions({ task: ["read"], ac: ["read"] })).toEqual([]);
    expect(unknownPermissions({ constructor: ["x"] })).toEqual([
      "constructor:*",
    ]);
  });

  it("splits a permission map into single permissions", () => {
    expect(eachPermission({ task: ["read", "update"], ac: [] })).toEqual([
      { task: ["read"] },
      { task: ["update"] },
    ]);
  });
});
