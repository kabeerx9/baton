// Every permission resource and action a workspace role can hold. Stored
// workspace_role rows and API keys reference these strings.
//
// `task:update_assigned` works only on tasks assigned to the caller. Holding
// `task:update` implies it (`IMPLIED_BY` in permits.ts).
export const statement = {
  member: ["update", "delete"],
  join_link: ["create"],
  role: ["create", "read", "update", "delete"],
  project: ["create", "read", "update", "delete", "share"],
  task: ["create", "read", "update", "delete", "assign", "update_assigned"],
  label: ["create", "read", "update", "delete"],
  workspace: ["read", "update", "delete", "manage_settings"],
} as const;

export type PermissionStatements = Readonly<Record<string, readonly string[]>>;
