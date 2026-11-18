import { defaultStatements } from "better-auth/plugins/organization/access";
import { describe, expect, it } from "vite-plus/test";
import { builtInRoles } from "./provider-roles";
import {
  BUILT_IN_ROLE_STATEMENTS,
  type BuiltInRoleName,
  builtInRoleStatements,
  defaultRolePayloads,
} from "./roles";
import { statement } from "./statements";

// defaultRolePayloads as JSON on main at 5a570a9, before the plain-data move.
const PAYLOADS_BEFORE =
  '{"viewer":{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"project":["read"],"task":["read"],"label":["read"],"workspace":["read"]},"member":{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"project":["create","read"],"task":["create","read","update"],"label":["create","read","update","delete"],"workspace":["read"]},"admin":{"organization":["update"],"invitation":["create","cancel"],"member":["create","update","delete"],"team":["create","update","delete"],"ac":["create","read","update","delete"],"project":["create","read","update","delete","share"],"task":["create","read","update","delete","assign"],"label":["create","read","update","delete"],"workspace":["read","update","manage_settings"]}}';

const ROLE_NAMES = Object.keys(builtInRoles) as BuiltInRoleName[];

describe("plain roles match the provider roles", () => {
  it("covers the same role names", () => {
    expect(Object.keys(BUILT_IN_ROLE_STATEMENTS)).toEqual(ROLE_NAMES);
  });

  it.each(ROLE_NAMES)(
    "%s has the same statements, in the same order",
    (name) => {
      const plain = BUILT_IN_ROLE_STATEMENTS[name];
      const provider = builtInRoles[name].statements;
      expect(plain).toEqual(provider);
      expect(JSON.stringify(plain)).toBe(JSON.stringify(provider));
    },
  );

  it("writes out the provider's default resources unchanged", () => {
    for (const [resource, actions] of Object.entries(defaultStatements)) {
      expect(statement[resource as keyof typeof statement]).toEqual(actions);
    }
  });
});

describe("defaultRolePayloads", () => {
  it("is byte-equal to the value before the plain-data move", () => {
    expect(JSON.stringify(defaultRolePayloads)).toBe(PAYLOADS_BEFORE);
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
