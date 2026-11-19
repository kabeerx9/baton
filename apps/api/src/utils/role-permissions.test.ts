import { describe, expect, it } from "vite-plus/test";
import {
  roleAllows,
  rolesAllow,
  rolesMissingPermissions,
  satisfies,
} from "./role-permissions";

// project:read probes "does this role grant it"; workspace:read every role
// grants (see "membership implies workspace:read").
const projectRead = { project: ["read"] };
const workspaceRead = { workspace: ["read"] };

describe("roleAllows", () => {
  it("uses the built-in statements when no permission is stored", () => {
    expect(roleAllows("viewer", null, projectRead)).toBe(true);
    expect(roleAllows("viewer", undefined, { task: ["create"] })).toBe(false);
  });

  it("prefers the stored permission over the built-in statements", () => {
    const stored = JSON.stringify({ task: ["read"] });

    expect(roleAllows("member", stored, projectRead)).toBe(false);
    expect(roleAllows("member", stored, { task: ["read"] })).toBe(true);
  });

  it("grants each built-in role exactly its plain statements", () => {
    expect(roleAllows("owner", null, { workspace: ["delete"] })).toBe(true);
    expect(roleAllows("admin", null, { workspace: ["delete"] })).toBe(false);
    expect(roleAllows("admin", null, { workspace: ["update"] })).toBe(true);
    expect(roleAllows("member", null, { task: ["update"] })).toBe(true);
    expect(roleAllows("member", null, { task: ["delete"] })).toBe(false);
  });

  it("treats an inherited object key as an unknown role", () => {
    expect(roleAllows("constructor", null, {})).toBe(false);
    expect(roleAllows("toString", null, {})).toBe(false);
  });

  it("reads a custom role from its stored permission only", () => {
    expect(roleAllows("custom", null, projectRead)).toBe(false);
    expect(roleAllows("custom", JSON.stringify(projectRead), projectRead)).toBe(
      true,
    );
  });

  it("falls back to the built-in statements when the stored JSON is malformed", () => {
    expect(roleAllows("viewer", "{not json", projectRead)).toBe(true);
    expect(roleAllows("custom", "{not json", projectRead)).toBe(false);
  });

  it("ignores malformed entries in the stored permission", () => {
    const stored = JSON.stringify({
      project: "read",
      task: ["read", 1],
    });

    expect(roleAllows("custom", stored, projectRead)).toBe(false);
    expect(roleAllows("custom", stored, { task: ["read"] })).toBe(true);
  });
});

describe("rolesAllow", () => {
  const noRead = JSON.stringify({ task: ["read"] });
  const read = JSON.stringify(projectRead);

  it("allows when any role grants the permission", () => {
    expect(
      rolesAllow(
        ["limited", "reader"],
        [
          { role: "limited", permission: noRead },
          { role: "reader", permission: read },
        ],
        projectRead,
      ),
    ).toBe(true);
    expect(
      rolesAllow(
        ["limited", "viewer"],
        [{ role: "limited", permission: noRead }],
        projectRead,
      ),
    ).toBe(true);
  });

  it("denies when no role grants the permission", () => {
    expect(
      rolesAllow(
        ["limited", "viewer"],
        [
          { role: "limited", permission: noRead },
          { role: "viewer", permission: noRead },
        ],
        projectRead,
      ),
    ).toBe(false);
    expect(rolesAllow([], [], projectRead)).toBe(false);
  });

  it("allows when any duplicate row for a role grants the permission", () => {
    for (const stored of [
      [
        { role: "custom", permission: noRead },
        { role: "custom", permission: read },
      ],
      [
        { role: "custom", permission: read },
        { role: "custom", permission: noRead },
      ],
    ]) {
      expect(rolesAllow(["custom"], stored, projectRead)).toBe(true);
    }
  });

  it("ignores stored rows for roles the member does not have", () => {
    expect(
      rolesAllow(
        ["limited"],
        [
          { role: "limited", permission: noRead },
          { role: "reader", permission: read },
        ],
        projectRead,
      ),
    ).toBe(false);
  });
});

describe("rolesMissingPermissions", () => {
  const required = { task: ["create", "update"], project: ["read"] };

  it("lists what a single role lacks", () => {
    expect(
      rolesMissingPermissions(
        ["custom"],
        [{ role: "custom", permission: JSON.stringify({ task: ["create"] }) }],
        required,
      ),
    ).toEqual(["task:update", "project:read"]);
  });

  it("reports the role that lacks the fewest permissions", () => {
    expect(
      rolesMissingPermissions(
        ["far", "near"],
        [
          { role: "far", permission: JSON.stringify({ label: ["read"] }) },
          {
            role: "near",
            permission: JSON.stringify({
              task: ["create", "update"],
            }),
          },
        ],
        required,
      ),
    ).toEqual(["project:read"]);
  });

  it("compares every duplicate row and the built-in fallback", () => {
    expect(
      rolesMissingPermissions(
        ["custom", "viewer"],
        [
          { role: "custom", permission: JSON.stringify({ task: ["read"] }) },
          {
            role: "custom",
            permission: JSON.stringify({ task: ["create", "update"] }),
          },
        ],
        required,
      ),
    ).toEqual(["project:read"]);
    expect(rolesMissingPermissions(["viewer"], [], required)).toEqual([
      "task:create",
      "task:update",
    ]);
  });

  it("lists every required permission when the member has no roles", () => {
    expect(rolesMissingPermissions([], [], required)).toEqual([
      "task:create",
      "task:update",
      "project:read",
    ]);
  });

  it("returns nothing when a role grants every permission", () => {
    expect(
      rolesMissingPermissions(
        ["limited", "admin"],
        [{ role: "limited", permission: JSON.stringify({ task: ["read"] }) }],
        required,
      ),
    ).toEqual([]);
  });
});

describe("membership implies workspace:read", () => {
  it("grants workspace:read to a custom role that leaves it out", () => {
    const stored = JSON.stringify({ task: ["read", "update_assigned"] });
    expect(roleAllows("custom", stored, workspaceRead)).toBe(true);
    expect(
      rolesAllow(
        ["custom"],
        [{ role: "custom", permission: stored }],
        workspaceRead,
      ),
    ).toBe(true);
    expect(roleAllows("custom", stored, { workspace: ["update"] })).toBe(false);
  });

  it("grants it to every built-in role", () => {
    for (const role of ["viewer", "member", "admin", "owner"])
      expect(roleAllows(role, null, workspaceRead), role).toBe(true);
  });

  it("grants nothing to an unknown role or to no role", () => {
    expect(roleAllows("custom", null, workspaceRead)).toBe(false);
    expect(rolesAllow([], [], workspaceRead)).toBe(false);
  });
});

describe("satisfies", () => {
  it("requires every action of every resource", () => {
    const statements = { task: ["read", "update"], label: ["read"] };

    expect(satisfies(statements, { task: ["read", "update"] })).toBe(true);
    expect(satisfies(statements, { task: ["delete"] })).toBe(false);
    expect(satisfies(statements, { workspace: ["read"] })).toBe(false);
  });
});
