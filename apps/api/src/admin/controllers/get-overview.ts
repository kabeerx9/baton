import { count, desc, eq, sql } from "drizzle-orm";
import db, { schema } from "../../database";
import { identity } from "../../identity";
import { getInstanceSettings } from "../../instance-settings/get-instance-settings";
import { instanceAdminRoleSql } from "../../utils/instance-admin-role";
import { notBannedCondition } from "../../utils/user-ban";
import { configurationWarnings } from "../overview/configuration-warnings";
import { getServiceStatus } from "../system/get-service-status";

export default async function getOverview() {
  const {
    userTable: user,
    workspaceTable: workspace,
    adminAuditLogTable: audit,
  } = schema;
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);
  const enabled = notBannedCondition();
  const [
    [
      users = {
        total: 0,
        deactivated: 0,
        enabledAdmins: 0,
      },
    ],
    [workspaces = { total: 0, archived: 0 }],
    recentUsers,
    recentActions,
    services,
    activeLast30Days,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        deactivated: sql`count(*) filter (where not (${enabled}))`.mapWith(
          Number,
        ),
        enabledAdmins:
          sql`count(*) filter (where ${enabled} and ${instanceAdminRoleSql(user.role)})`.mapWith(
            Number,
          ),
      })
      .from(user),
    db
      .select({
        total: count(),
        archived:
          sql`count(*) filter (where ${workspace.archivedAt} is not null)`.mapWith(
            Number,
          ),
      })
      .from(workspace)
      // Product-tour sandboxes are not workspaces anyone runs.
      .where(eq(workspace.kind, "team")),
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(5),
    db
      .select({
        id: audit.id,
        createdAt: audit.createdAt,
        action: audit.action,
        actor: {
          id: audit.actorUserId,
          name: audit.actorName,
          email: audit.actorEmail,
        },
        targetType: audit.targetType,
        targetId: audit.targetId,
        targetLabel: audit.targetLabel,
      })
      .from(audit)
      .orderBy(desc(audit.createdAt), desc(audit.id))
      .limit(5),
    getServiceStatus(),
    identity.sessions.countActiveUsers(cutoff),
  ]);
  return {
    users: {
      total: users.total,
      activeLast30Days,
      deactivated: users.deactivated,
    },
    workspaces,
    recentUsers: recentUsers.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    recentActions: recentActions.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    services: {
      checkedAt: services.checkedAt,
      api: services.api.status,
      database: services.database.status,
      realtime: services.realtime.status,
      redis: services.redis.status,
      email: services.email.status,
      storage: services.storage.status,
    },
    warnings: configurationWarnings(
      services,
      (await getInstanceSettings()).registrationEnabled,
      users.enabledAdmins,
    ),
  };
}
