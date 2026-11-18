import {
  builtInRoleStatements,
  type PermissionStatements,
  permits,
} from "@baton/permissions";

// Existing callers check API-key grants with this name.
export { permits as satisfies } from "@baton/permissions";
import { missingPermissions } from "./missing-permissions";

export type PermissionMap = Record<string, string[]>;

function parsePermissionStatements(raw: string): PermissionStatements | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  // Only keep entries shaped like { [resource: string]: string[] }.
  // Anything malformed is dropped so `permits()` never calls
  // `.includes()` on a non-array.
  const result: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!Array.isArray(actions)) continue;
    const filtered = actions.filter(
      (action): action is string => typeof action === "string",
    );
    if (filtered.length > 0) {
      result[resource] = filtered;
    }
  }
  return result;
}

function roleStatements(
  role: string,
  storedPermission: string | null | undefined,
): PermissionStatements | null {
  return (
    (storedPermission ? parsePermissionStatements(storedPermission) : null) ??
    builtInRoleStatements(role)
  );
}

export function roleAllows(
  role: string,
  storedPermission: string | null | undefined,
  permissions: PermissionMap,
) {
  const statements = roleStatements(role, storedPermission);
  return Boolean(statements && permits(statements, permissions));
}

export type StoredRolePermission = {
  role: string;
  permission: string | null;
};

function candidateStatements(
  roles: readonly string[],
  stored: readonly StoredRolePermission[],
) {
  return roles.flatMap((role) => {
    const rows = stored.filter((row) => row.role === role);
    if (rows.length === 0) return [roleStatements(role, null)];
    return rows.map((row) => roleStatements(role, row.permission));
  });
}

export function rolesAllow(
  roles: readonly string[],
  stored: readonly StoredRolePermission[],
  permissions: PermissionMap,
) {
  return candidateStatements(roles, stored).some((statements) =>
    Boolean(statements && permits(statements, permissions)),
  );
}

export function rolesMissingPermissions(
  roles: readonly string[],
  stored: readonly StoredRolePermission[],
  permissions: PermissionMap,
): string[] {
  let closest = missingPermissions(null, permissions);
  for (const statements of candidateStatements(roles, stored)) {
    const missing = missingPermissions(statements, permissions);
    if (missing.length < closest.length) closest = missing;
  }
  return closest;
}
