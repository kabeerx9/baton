import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../database";
import { hasInstanceAdminRole } from "./instance-admin-role";
import {
  type PermissionMap,
  rolesAllow,
  satisfies,
  type StoredRolePermission,
} from "./role-permissions";
import { splitRoles } from "./split-roles";
import { notBannedCondition } from "./user-ban";

// Resolve current grants once for a request spanning multiple workspaces.
// Role rows must stay grouped by workspace: the same role name can differ.
export async function workspacePermissionGrants(
  userId: string,
  {
    apiKeyPermissions,
    workspaceIds,
  }: {
    apiKeyPermissions?: PermissionMap | null;
    workspaceIds?: string[];
  } = {},
) {
  const [users, members, kinds] = await Promise.all([
    db
      .select({ role: schema.userTable.role })
      .from(schema.userTable)
      .where(and(eq(schema.userTable.id, userId), notBannedCondition()))
      .limit(1),
    db
      .select({
        workspaceId: schema.workspaceUserTable.workspaceId,
        role: schema.workspaceUserTable.role,
      })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.userId, userId),
          workspaceIds
            ? inArray(schema.workspaceUserTable.workspaceId, workspaceIds)
            : undefined,
        ),
      ),
    workspaceIds?.length
      ? db
          .select({
            id: schema.workspaceTable.id,
            kind: schema.workspaceTable.kind,
          })
          .from(schema.workspaceTable)
          .where(inArray(schema.workspaceTable.id, workspaceIds))
      : Promise.resolve([]),
  ]);
  const isInstanceAdmin = hasInstanceAdminRole(users[0]?.role);
  const kindOf = new Map(kinds.map((row) => [row.id, row.kind]));
  const memberRoles = new Map(
    members.map((member) => [member.workspaceId, splitRoles(member.role)]),
  );
  const memberWorkspaceIds = [...memberRoles.keys()];
  const roleNames = [...new Set([...memberRoles.values()].flat())];
  const stored =
    !isInstanceAdmin && memberWorkspaceIds.length && roleNames.length
      ? await db
          .select({
            workspaceId: schema.workspaceRoleTable.workspaceId,
            role: schema.workspaceRoleTable.role,
            permission: schema.workspaceRoleTable.permission,
          })
          .from(schema.workspaceRoleTable)
          .where(
            and(
              inArray(
                schema.workspaceRoleTable.workspaceId,
                memberWorkspaceIds,
              ),
              inArray(schema.workspaceRoleTable.role, roleNames),
            ),
          )
      : [];
  const storedByWorkspace = new Map<string, StoredRolePermission[]>();
  for (const row of stored) {
    const rows = storedByWorkspace.get(row.workspaceId) ?? [];
    rows.push(row);
    storedByWorkspace.set(row.workspaceId, rows);
  }

  return {
    isInstanceAdmin,
    workspaceIds: memberWorkspaceIds,
    /**
     * `kind` is the workspace's kind when the caller read it; otherwise the
     * kind loaded for `workspaceIds` is used. An administrator's bypass
     * covers team workspaces only: a demo is reachable through membership,
     * and an unknown kind is treated as a demo.
     */
    allows(workspaceId: string, permissions: PermissionMap, kind?: string) {
      if (!users.length) return false;
      if (apiKeyPermissions && !satisfies(apiKeyPermissions, permissions)) {
        return false;
      }
      const adminBypass =
        isInstanceAdmin &&
        (memberRoles.has(workspaceId) ||
          (kind ?? kindOf.get(workspaceId)) === "team");
      return (
        adminBypass ||
        rolesAllow(
          memberRoles.get(workspaceId) ?? [],
          storedByWorkspace.get(workspaceId) ?? [],
          permissions,
        )
      );
    },
  };
}
