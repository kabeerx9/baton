import { describe, expect, it } from "vite-plus/test";
import {
  BUILT_IN_ROLE_STATEMENTS,
  builtInRoleStatements,
  defaultRolePayloads,
} from "./roles";
import { statement } from "./statements";

describe("built-in roles", () => {
  it("name only resources and actions the vocabulary knows", () => {
    for (const role of Object.values(BUILT_IN_ROLE_STATEMENTS))
      for (const [resource, actions] of Object.entries(role)) {
        const known = (statement as Record<string, readonly string[]>)[
          resource
        ];
        expect(known, resource).toBeDefined();
        for (const action of actions) expect(known).toContain(action);
      }
  });

  it("give each built-in role every resource of the vocabulary", () => {
    for (const role of Object.values(BUILT_IN_ROLE_STATEMENTS))
      expect(Object.keys(role).sort()).toEqual(Object.keys(statement).sort());
  });
});

describe("defaultRolePayloads", () => {
  it("holds the seeded roles as plain copies of the built-in roles", () => {
    for (const name of ["viewer", "member", "admin"] as const)
      expect(defaultRolePayloads[name]).toEqual(BUILT_IN_ROLE_STATEMENTS[name]);
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

  it("reads everything", () => {
    expect(viewer.project).toEqual(["read"]);
    expect(viewer.label).toEqual(["read"]);
    expect(viewer.workspace).toEqual(["read"]);
    expect(viewer.role).toEqual(["read"]);
  });

  it("is seeded with task:update_assigned", () => {
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
