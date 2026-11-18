import type { schema } from "../database";

type RoleRow = typeof schema.workspaceRoleTable.$inferSelect;

function parsePermission(raw: string): Record<string, string[]> {
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as Record<string, string[]>;
  } catch {}
  return {};
}

/** A role row with its permission as an object, as the provider answered. */
export function toRoleResponse(row: RoleRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    role: row.role,
    permission: parsePermission(row.permission),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
