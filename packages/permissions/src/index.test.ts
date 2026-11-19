import { describe, expect, it } from "vite-plus/test";
import {
  BUILT_IN_ROLE_STATEMENTS,
  DEFAULT_ROLE_NAMES,
  defaultRolePayloads,
  statement,
} from "./index";

const { viewer, member, admin, owner } = BUILT_IN_ROLE_STATEMENTS;

describe("@baton/permissions statement surface", () => {
  it("exposes Baton's resource statements", () => {
    expect(statement.project).toEqual([
      "create",
      "read",
      "update",
      "delete",
      "share",
    ]);
    expect(statement.task).toEqual([
      "create",
      "read",
      "update",
      "delete",
      "assign",
      "update_assigned",
    ]);
    expect(statement.label).toEqual(["create", "read", "update", "delete"]);
    expect(statement.workspace).toEqual([
      "read",
      "update",
      "delete",
      "manage_settings",
    ]);
    expect(statement.member).toEqual(["update", "delete"]);
    expect(statement.join_link).toEqual(["create"]);
    expect(statement.role).toEqual(["create", "read", "update", "delete"]);
  });
});

describe("built-in role privileges", () => {
  it("viewer reads everything and works only on tasks assigned to them", () => {
    expect(viewer.project).toEqual(["read"]);
    expect(viewer.task).toEqual(["read", "update_assigned"]);
    expect(viewer.label).toEqual(["read"]);
    expect(viewer.workspace).toEqual(["read"]);
  });

  it("member can create/read/update tasks but not delete or manage settings", () => {
    expect(member.task).toContain("create");
    expect(member.task).toContain("update");
    expect(member.task).not.toContain("delete");
    expect(member.project).toContain("create");
    expect(member.project).not.toContain("delete");
    expect(member.workspace).toEqual(["read"]);
  });

  it("admin can delete tasks and manage workspace settings but cannot delete the workspace", () => {
    expect(admin.task).toContain("delete");
    expect(admin.task).toContain("assign");
    expect(admin.project).toContain("delete");
    expect(admin.project).toContain("share");
    expect(admin.workspace).toContain("manage_settings");
    expect(admin.workspace).not.toContain("delete");
  });

  it("owner has every Baton resource action including workspace:delete", () => {
    expect(owner.task).toEqual(
      expect.arrayContaining(["create", "read", "update", "delete", "assign"]),
    );
    expect(owner.project).toEqual(
      expect.arrayContaining(["create", "read", "update", "delete", "share"]),
    );
    expect(owner.workspace).toEqual(
      expect.arrayContaining(["read", "update", "delete", "manage_settings"]),
    );
  });

  it("names all four built-in roles", () => {
    expect(Object.keys(BUILT_IN_ROLE_STATEMENTS).sort()).toEqual([
      "admin",
      "member",
      "owner",
      "viewer",
    ]);
  });
});

describe("default-role seed payloads", () => {
  it("names the seedable defaults but excludes owner (kept as static role)", () => {
    expect(DEFAULT_ROLE_NAMES).toEqual(["viewer", "member", "admin"]);
    expect(DEFAULT_ROLE_NAMES).not.toContain("owner");
    expect(Object.keys(defaultRolePayloads).sort()).toEqual([
      "admin",
      "member",
      "viewer",
    ]);
  });

  it("emits JSON-serializable payloads that mirror each role's compiled statements", () => {
    for (const name of DEFAULT_ROLE_NAMES) {
      const role = BUILT_IN_ROLE_STATEMENTS[name];
      const payload = defaultRolePayloads[name];

      // Every resource the compiled role declares must appear in the payload
      // with the same set of actions (order-insensitive). Otherwise a seeded
      // workspace_role row would silently drift from the static role.
      for (const [resource, actions] of Object.entries(role)) {
        expect(payload[resource]).toBeDefined();
        expect([...payload[resource]].sort()).toEqual([...actions].sort());
      }

      // Round-trips through JSON without loss; the API stores these as text.
      const roundTripped = JSON.parse(JSON.stringify(payload));
      expect(roundTripped).toEqual(payload);
    }
  });

  it("returns a fresh mutable array per resource so callers can edit safely", () => {
    const memberPayload = defaultRolePayloads.member;
    memberPayload.task.push("__test_marker");
    // Re-import-equivalent check: the in-memory payload is mutable but the
    // role object's statements are decoupled (we only mutated the copy).
    expect(memberPayload.task).toContain("__test_marker");
    expect(member.task).not.toContain("__test_marker" as never);
  });
});
