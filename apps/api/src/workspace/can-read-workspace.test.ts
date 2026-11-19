import { describe, expect, it } from "vite-plus/test";
import { canReadWorkspace } from "./can-read-workspace";

const noRead = JSON.stringify({ task: ["read"] });
const read = JSON.stringify({ workspace: ["read"] });

describe("canReadWorkspace", () => {
  it("allows built-in roles", () => {
    for (const role of ["viewer", "member", "admin", "owner"]) {
      expect(canReadWorkspace({ role }, [])).toBe(true);
    }
  });

  it("allows a member whose custom role leaves out workspace:read", () => {
    expect(
      canReadWorkspace({ role: "custom" }, [
        { role: "custom", permission: noRead },
      ]),
    ).toBe(true);
  });

  it("denies a member whose only role is unknown", () => {
    expect(canReadWorkspace({ role: "gone" }, [])).toBe(false);
  });

  it("allows a member with several roles, whatever each one grants", () => {
    expect(
      canReadWorkspace({ role: "limited,reader" }, [
        { role: "limited", permission: noRead },
        { role: "reader", permission: read },
      ]),
    ).toBe(true);
    expect(
      canReadWorkspace({ role: "limited,other" }, [
        { role: "limited", permission: noRead },
        { role: "other", permission: noRead },
      ]),
    ).toBe(true);
  });

  it("denies a non-member, instance administrators included", () => {
    expect(canReadWorkspace({ role: null }, [])).toBe(false);
  });
});
