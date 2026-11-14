import { and, eq, inArray, sql } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import {
  type PermissionMap,
  rolesAllow,
  satisfies,
} from "../utils/role-permissions";
import { splitRoles } from "../utils/split-roles";
import type { ConsentFacts } from "./consent";

export type ConsentTask = {
  id: string;
  projectId: string;
  createdBy: string | null;
  userId: string | null;
};

type Person = { userId: string; scope: PermissionMap | null };

const BYPASS_ROLES = new Set(["owner", "admin"]);

/**
 * What a person may do in a workspace: current stored role permissions (or
 * the instance-admin grant), narrowed by the API key scope; and whether a
 * membership role is a bypass role. Instance admins who are not members get
 * the permissions but no bypass.
 */
export async function loadPersonGrants(
  database: DbOrTx,
  workspaceId: string,
  person: Person,
) {
  const [row] = await database
    .select({
      memberRole: schema.workspaceUserTable.role,
      userRole: schema.userTable.role,
    })
    .from(schema.userTable)
    .leftJoin(
      schema.workspaceUserTable,
      and(
        eq(schema.workspaceUserTable.userId, schema.userTable.id),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .where(eq(schema.userTable.id, person.userId))
    .limit(1);
  const roles = splitRoles(row?.memberRole);
  const member = row?.memberRole != null;
  const instanceAdmin = hasInstanceAdminRole(row?.userRole);
  const stored =
    roles.length === 0
      ? []
      : await database
          .select({
            role: schema.workspaceRoleTable.role,
            permission: schema.workspaceRoleTable.permission,
          })
          .from(schema.workspaceRoleTable)
          .where(
            and(
              eq(schema.workspaceRoleTable.workspaceId, workspaceId),
              inArray(schema.workspaceRoleTable.role, roles),
            ),
          );
  const can = (permissions: PermissionMap) =>
    (!person.scope || satisfies(person.scope, permissions)) &&
    (instanceAdmin || (member && rolesAllow(roles, stored, permissions)));
  return {
    member,
    bypass: member && roles.some((role) => BYPASS_ROLES.has(role)),
    can,
  };
}

/** True when the person can still see the task's repo (board tasks: always). */
export async function canSeeTaskProject(
  database: DbOrTx,
  userId: string,
  projectId: string,
) {
  const [row] = await database
    .select({
      visible: sql<boolean>`(${schema.projectTable.kind} = 'board' or ${projectAccessCondition(userId, schema.projectTable.id)})`,
    })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId))
    .limit(1);
  return Boolean(row?.visible);
}

export async function projectWorkspaceId(database: DbOrTx, projectId: string) {
  const [row] = await database
    .select({ workspaceId: schema.projectTable.workspaceId })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId))
    .limit(1);
  return row?.workspaceId ?? null;
}

export async function isFeature(database: DbOrTx, taskId: string) {
  const [row] = await database
    .select({ id: schema.taskRelationTable.id })
    .from(schema.taskRelationTable)
    .where(
      and(
        eq(schema.taskRelationTable.sourceTaskId, taskId),
        eq(schema.taskRelationTable.relationType, "subtask"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Involved = the task's creator or assignee, still a workspace member, and
 * still able to see the task's repo. Provenance alone grants nothing.
 */
export async function isInvolved(
  database: DbOrTx,
  task: ConsentTask,
  userId: string,
  member: boolean,
) {
  if (!member) return false;
  if (task.createdBy !== userId && task.userId !== userId) return false;
  return canSeeTaskProject(database, userId, task.projectId);
}

export type PersonGrants = Awaited<ReturnType<typeof loadPersonGrants>>;

/** Facts for one task when the person's grants are already loaded. */
export async function consentFactsWith(
  database: DbOrTx,
  task: ConsentTask,
  userId: string,
  grants: PersonGrants,
): Promise<ConsentFacts> {
  return {
    involved: await isInvolved(database, task, userId, grants.member),
    bypass: grants.bypass,
    feature: await isFeature(database, task.id),
    canUpdate: grants.can({ task: ["update"] }),
    canDelete: grants.can({ task: ["delete"] }),
    canAssign: grants.can({ task: ["assign"] }),
  };
}

export async function loadConsentFacts(
  database: DbOrTx,
  task: ConsentTask,
  person: Person,
): Promise<ConsentFacts & { workspaceId: string }> {
  const workspaceId = await projectWorkspaceId(database, task.projectId);
  if (!workspaceId)
    return {
      workspaceId: "",
      involved: false,
      bypass: false,
      feature: false,
      canUpdate: false,
      canDelete: false,
      canAssign: false,
    };
  const grants = await loadPersonGrants(database, workspaceId, person);
  return {
    workspaceId,
    ...(await consentFactsWith(database, task, person.userId, grants)),
  };
}

/** The people who must consent: creator and assignee, with current access. */
export async function involvedPeople(database: DbOrTx, task: ConsentTask) {
  const workspaceId = await projectWorkspaceId(database, task.projectId);
  if (!workspaceId) return [];
  const ids = [...new Set([task.createdBy, task.userId])].filter(
    (id): id is string => Boolean(id),
  );
  const people: string[] = [];
  for (const id of ids) {
    const grants = await loadPersonGrants(database, workspaceId, {
      userId: id,
      scope: null,
    });
    if (await isInvolved(database, task, id, grants.member)) people.push(id);
  }
  return people;
}
