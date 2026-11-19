import { describe, expect, it } from "vite-plus/test";
import {
  BUILT_IN_ROLE_STATEMENTS,
  builtInRoleStatements,
  defaultRolePayloads,
} from "./roles";
import { statement } from "./statements";

// defaultRolePayloads as JSON on main at 5a570a9, before the plain-data move.
const PAYLOADS_BEFORE =
  '{"viewer":{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"project":["read"],"task":["read"],"label":["read"],"workspace":["read"]},"member":{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"project":["create","read"],"task":["create","read","update"],"label":["create","read","update","delete"],"workspace":["read"]},"admin":{"organization":["update"],"invitation":["create","cancel"],"member":["create","update","delete"],"team":["create","update","delete"],"ac":["create","read","update","delete"],"project":["create","read","update","delete","share"],"task":["create","read","update","delete","assign"],"label":["create","read","update","delete"],"workspace":["read","update","manage_settings"]}}';

// The provider's compiled role statements (Better Auth organization plugin,
// 1.7.14), frozen when the plugin left (auth-boundary P3). The plain roles
// must stay equal to them, key order included.
const PROVIDER_ROLES_FROZEN =
  '{"viewer":{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"project":["read"],"task":["read"],"label":["read"],"workspace":["read"]},"member":{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"project":["create","read"],"task":["create","read","update"],"label":["create","read","update","delete"],"workspace":["read"]},"admin":{"organization":["update"],"invitation":["create","cancel"],"member":["create","update","delete"],"team":["create","update","delete"],"ac":["create","read","update","delete"],"project":["create","read","update","delete","share"],"task":["create","read","update","delete","assign"],"label":["create","read","update","delete"],"workspace":["read","update","manage_settings"]},"owner":{"organization":["update","delete"],"member":["create","update","delete"],"invitation":["create","cancel"],"team":["create","update","delete"],"ac":["create","read","update","delete"],"project":["create","read","update","delete","share"],"task":["create","read","update","delete","assign"],"label":["create","read","update","delete"],"workspace":["read","update","delete","manage_settings"]}}';

/**
 * A snapshot as the roles are now: `team` removed (it left the vocabulary in
 * auth-boundary P4), and the viewer works on tasks assigned to them.
 */
function withoutTeam(snapshot: string) {
  const roles = JSON.parse(snapshot) as Record<string, Record<string, unknown>>;
  for (const role of Object.values(roles)) delete role.team;
  if (roles.viewer) roles.viewer.task = ["read", "update_assigned"];
  return JSON.stringify(roles);
}

// The plugin's own default resources, written out in statements.ts.
const PROVIDER_DEFAULT_STATEMENTS = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  ac: ["create", "read", "update", "delete"],
};

describe("plain roles match the frozen provider roles", () => {
  it("is byte-equal to the snapshot, less `team`, with the working viewer", () => {
    expect(JSON.stringify(BUILT_IN_ROLE_STATEMENTS)).toBe(
      withoutTeam(PROVIDER_ROLES_FROZEN),
    );
  });

  it("no longer knows `team`", () => {
    expect(Object.keys(statement)).not.toContain("team");
  });

  it("writes out the provider's default resources unchanged", () => {
    for (const [resource, actions] of Object.entries(
      PROVIDER_DEFAULT_STATEMENTS,
    )) {
      expect(statement[resource as keyof typeof statement]).toEqual(actions);
    }
  });
});

describe("defaultRolePayloads", () => {
  it("is byte-equal to the value before the plain-data move, less `team`, with the working viewer", () => {
    expect(JSON.stringify(defaultRolePayloads)).toBe(
      withoutTeam(PAYLOADS_BEFORE),
    );
  });

  it("copies arrays, so a payload edit never changes a built-in role", () => {
    for (const name of ["viewer", "member", "admin"] as const) {
      for (const [resource, actions] of Object.entries(
        defaultRolePayloads[name],
      )) {
        const builtIn = BUILT_IN_ROLE_STATEMENTS[name] as Record<
          string,
          readonly string[]
        >;
        expect(actions).not.toBe(builtIn[resource]);
      }
    }
  });
});

describe("builtInRoleStatements", () => {
  it("returns a built-in role's statements", () => {
    expect(builtInRoleStatements("owner")).toBe(BUILT_IN_ROLE_STATEMENTS.owner);
  });

  it("returns null for custom roles and inherited object keys", () => {
    expect(builtInRoleStatements("custom")).toBeNull();
    expect(builtInRoleStatements("constructor")).toBeNull();
    expect(builtInRoleStatements("__proto__")).toBeNull();
  });
});

describe("viewer works only on assigned tasks", () => {
  const viewer = BUILT_IN_ROLE_STATEMENTS.viewer;

  it("holds task:update_assigned but not update, create, delete or assign", () => {
    expect(viewer.task).toEqual(["read", "update_assigned"]);
    for (const action of ["create", "update", "delete", "assign"])
      expect(viewer.task).not.toContain(action);
  });

  it("still reads everything it read before", () => {
    expect(viewer.project).toEqual(["read"]);
    expect(viewer.label).toEqual(["read"]);
    expect(viewer.workspace).toEqual(["read"]);
    expect(viewer.ac).toEqual(["read"]);
  });

  it("seeds the new payload for existing and new workspaces", () => {
    expect(defaultRolePayloads.viewer.task).toEqual([
      "read",
      "update_assigned",
    ]);
  });

  it("leaves member, admin and owner without the literal action", () => {
    for (const name of ["member", "admin", "owner"] as const)
      expect(BUILT_IN_ROLE_STATEMENTS[name].task).not.toContain(
        "update_assigned",
      );
  });
});
