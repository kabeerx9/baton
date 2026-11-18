// Every permission resource and action a workspace role can hold. The first
// five resources were the Better Auth organization plugin's defaults; they are
// written out here so Baton owns its vocabulary. Do not rename any string:
// stored workspace_role rows and API keys reference them.
export const statement = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  ac: ["create", "read", "update", "delete"],
  project: ["create", "read", "update", "delete", "share"],
  task: ["create", "read", "update", "delete", "assign"],
  label: ["create", "read", "update", "delete"],
  workspace: ["read", "update", "delete", "manage_settings"],
} as const;

export type PermissionStatements = Readonly<Record<string, readonly string[]>>;
