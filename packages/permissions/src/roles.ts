import type { PermissionStatements } from "./statements.js";

// Built-in workspace roles as plain data. The viewer works on tasks assigned
// to them (`task:update_assigned`).
export const BUILT_IN_ROLE_STATEMENTS = {
  viewer: {
    member: [],
    join_link: [],
    role: ["read"],
    project: ["read"],
    task: ["read", "update_assigned"],
    label: ["read"],
    workspace: ["read"],
  },
  member: {
    member: [],
    join_link: [],
    role: ["read"],
    project: ["create", "read"],
    task: ["create", "read", "update"],
    label: ["create", "read", "update", "delete"],
    workspace: ["read"],
  },
  admin: {
    member: ["update", "delete"],
    join_link: ["create"],
    role: ["create", "read", "update", "delete"],
    project: ["create", "read", "update", "delete", "share"],
    task: ["create", "read", "update", "delete", "assign"],
    label: ["create", "read", "update", "delete"],
    workspace: ["read", "update", "manage_settings"],
  },
  owner: {
    member: ["update", "delete"],
    join_link: ["create"],
    role: ["create", "read", "update", "delete"],
    project: ["create", "read", "update", "delete", "share"],
    task: ["create", "read", "update", "delete", "assign"],
    label: ["create", "read", "update", "delete"],
    workspace: ["read", "update", "delete", "manage_settings"],
  },
} as const satisfies Record<string, PermissionStatements>;

export type BuiltInRoleName = keyof typeof BUILT_IN_ROLE_STATEMENTS;

export function builtInRoleStatements(
  role: string,
): PermissionStatements | null {
  return Object.hasOwn(BUILT_IN_ROLE_STATEMENTS, role)
    ? BUILT_IN_ROLE_STATEMENTS[role as BuiltInRoleName]
    : null;
}

// Default-role names that the API seeds per workspace. These ARE editable in
// the UI (their permissions live as rows in `workspace_role`), but their names
// are reserved and the rows are created with the workspace. `owner` is
// intentionally NOT in this list because it stays a static role.
export const DEFAULT_ROLE_NAMES = ["viewer", "member", "admin"] as const;
export type DefaultRoleName = (typeof DEFAULT_ROLE_NAMES)[number];

function toMutablePayload(
  statements: PermissionStatements,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(statements)) {
    out[resource] = [...actions];
  }
  return out;
}

// Plain JSON-serializable permission payloads for the seeded default roles.
// Each array is a copy, so editing a payload never changes a built-in role.
export const defaultRolePayloads: Record<
  DefaultRoleName,
  Record<string, string[]>
> = {
  viewer: toMutablePayload(BUILT_IN_ROLE_STATEMENTS.viewer),
  member: toMutablePayload(BUILT_IN_ROLE_STATEMENTS.member),
  admin: toMutablePayload(BUILT_IN_ROLE_STATEMENTS.admin),
};
