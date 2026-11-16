import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { WEBHOOK_CATEGORIES } from "../admin/webhooks/categories";
import type { AuditWebhookPayload } from "../admin/webhooks/audit-webhook-payload";
import type { GitHubImportState } from "../github-integration/import-state";

// Timestamp columns without a time zone hold UTC (Drizzle reads and writes
// them as UTC). A bare now() default would be cast through the session time
// zone, storing shifted times on servers not running in UTC.
const utcNow = sql`(now() AT TIME ZONE 'utc')`;

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const userTable = pgTable("user", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { mode: "date" }),
  // Set on password sign-ups while the instance requires email verification.
  emailVerificationRequired: boolean("email_verification_required")
    .default(false)
    .notNull(),
});

export const sessionTable = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
    activeTeamId: text("active_team_id"),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const accountTable = pgTable(
  "account",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    /**
     * Bumped by a trigger in the same UPDATE that changes `password`
     * (migration 0080), on every path. MCP codes snapshot it at consent.
     */
    credentialGeneration: integer("credential_generation").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const userAvatarTable = pgTable(
  "user_avatar",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique("user_avatar_user_id_unique")
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_avatar_userId_idx").on(table.userId)],
);

// Instance administration history. Actor and target details are snapshots so
// entries stay readable after the people or records involved are deleted.
export const adminAuditLogTable = pgTable(
  "admin_audit_log",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    actorUserId: text("actor_user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    actorName: text("actor_name"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    targetLabel: text("target_label"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("admin_audit_log_createdAt_idx").on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("admin_audit_log_actorUserId_idx").on(table.actorUserId),
    index("admin_audit_log_target_idx").on(table.targetType, table.targetId),
  ],
);

export const instanceWebhookTable = pgTable("instance_webhook", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  url: text("url").notNull(),
  categories: text("categories")
    .array()
    .$type<(typeof WEBHOOK_CATEGORIES)[number][]>()
    .notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  signingSecret: text("signing_secret").notNull(),
  cancelPendingBefore: timestamp("cancel_pending_before", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

export const instanceWebhookDeliveryTable = pgTable(
  "instance_webhook_delivery",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => instanceWebhookTable.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<AuditWebhookPayload>().notNull(),
    state: text("state")
      .$type<"pending" | "succeeded" | "failed">()
      .default("pending")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    statusCode: integer("status_code"),
    errorCode: text("error_code"),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    // Use the enqueue statement's snapshot time, even inside an older action transaction.
    createdAt: timestamp("created_at", { mode: "date" })
      .default(sql`(statement_timestamp() AT TIME ZONE 'utc')`)
      .notNull(),
  },
  (table) => [
    index("instance_webhook_delivery_due_idx").on(
      table.state,
      table.nextAttemptAt,
    ),
    index("instance_webhook_delivery_history_idx").on(
      table.webhookId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

// Custom instance roles. Users hold them by name in their comma-separated
// `user.role`, next to the built-in `admin` and `user` roles.
export const instanceRoleTable = pgTable("instance_role", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull().unique(),
  permissions: text("permissions")
    .array()
    .notNull()
    .default(sql`'{}'`),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .$onUpdate(() => new Date())
    .notNull(),
});

// A single row (id "instance"). Without it, every setting has its default.
export const instanceSettingsTable = pgTable("instance_settings", {
  id: text("id").primaryKey().default("instance"),
  instanceName: text("instance_name"),
  registrationEnabled: boolean("registration_enabled").default(true).notNull(),
  passwordRegistrationEnabled: boolean("password_registration_enabled")
    .default(true)
    .notNull(),
  requireEmailVerification: boolean("require_email_verification")
    .default(false)
    .notNull(),
  defaultRoleId: text("default_role_id").references(
    () => instanceRoleTable.id,
    {
      onDelete: "restrict",
    },
  ),
  workspaceCreationRestricted: boolean("workspace_creation_restricted")
    .default(false)
    .notNull(),
  disabledIntegrations: text("disabled_integrations")
    .array()
    .notNull()
    .default(sql`'{}'`),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verificationTable = pgTable(
  "verification",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const workspaceTable = pgTable("workspace", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  // Set by an instance administrator. Archived workspaces keep their data but
  // members, API keys and integrations can no longer use them.
  archivedAt: timestamp("archived_at", { mode: "date" }),
  archivedBy: text("archived_by").references(() => userTable.id, {
    onDelete: "set null",
  }),
});

export const workspaceUserTable = pgTable(
  "workspace_member",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
      }),
    role: text("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull(),
  },
  (table) => [
    index("workspace_member_workspaceId_idx").on(table.workspaceId),
    index("workspace_member_userId_idx").on(table.userId),
  ],
);

export const teamTable = pgTable(
  "team",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    memberCount: integer("member_count").default(0).notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").$onUpdate(
      () => /* @__PURE__ */ new Date(),
    ),
  },
  (table) => [index("team_workspaceId_idx").on(table.workspaceId)],
);

export const teamMemberTable = pgTable(
  "team_member",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teamTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    membershipKey: text("membership_key").unique(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("teamMember_teamId_idx").on(table.teamId),
    index("teamMember_userId_idx").on(table.userId),
  ],
);

export const invitationTable = pgTable(
  "invitation",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    teamId: text("team_id"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    projectAccess: text("project_access").default("all").notNull(),
    projectIds: text("project_ids")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
  },
  (table) => [
    index("invitation_workspaceId_idx").on(table.workspaceId),
    index("invitation_email_idx").on(table.email),
    index("invitation_inviterId_idx").on(table.inviterId),
  ],
);

export const workspaceRoleTable = pgTable(
  "workspace_role",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: text("role").notNull(),
    permission: text("permission").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workspace_role_workspaceId_idx").on(table.workspaceId),
    index("workspace_role_role_idx").on(table.role),
  ],
);

export const projectTable = pgTable(
  "project",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    slug: text("slug").notNull(),
    icon: text("icon").default("Layout"),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    includeSubtasks: boolean("include_subtasks").notNull().default(true),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    lastTaskNumber: integer("last_task_number").notNull().default(0),
    position: integer("position").notNull().default(0),
    // "repo" projects are the ones people see. Each workspace also has one
    // hidden "board" project that holds the tasks on its board.
    kind: text("kind").notNull().default("repo"),
    backgroundObjectKey: text("background_object_key"),
    backgroundMimeType: text("background_mime_type"),
    backgroundVersion: text("background_version"),
  },
  (table) => [
    index("project_background_object_key_idx")
      .on(table.backgroundObjectKey)
      .where(sql`${table.backgroundObjectKey} is not null`),
    unique("project_workspace_id_id_unique").on(table.workspaceId, table.id),
    uniqueIndex("project_one_board_per_workspace_idx")
      .on(table.workspaceId)
      .where(sql`${table.kind} = 'board'`),
    index("project_workspaceId_position_idx").on(
      table.workspaceId,
      table.position,
    ),
  ],
);

// Who a tracker user is in Slack, for direct messages. Filled by an email
// lookup the first time it is needed, or set by hand when the emails differ.
export const slackUserLinkTable = pgTable("slack_user_link", {
  userId: text("user_id")
    .primaryKey()
    .references(() => userTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Null means the lookup ran and Slack has no user with that email.
  slackUserId: text("slack_user_id"),
  source: text("source").notNull().default("email"),
  // When the email lookup last ran. Null means it has not run yet.
  checkedAt: timestamp("checked_at", { mode: "date" }),
  // The local day (YYYY-MM-DD) of the last morning digest, so a restart or a
  // second instance cannot send the same digest twice.
  lastDigestDay: text("last_digest_day"),
});

export const workspaceMemberAccessTable = pgTable(
  "workspace_member_access",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    projectAccess: text("project_access").default("all").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("workspace_member_access_workspace_user_unique").on(
      table.workspaceId,
      table.userId,
    ),
    index("workspace_member_access_userId_idx").on(table.userId),
  ],
);

export const workspaceMemberProjectTable = pgTable(
  "workspace_member_project",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projectTable.workspaceId, projectTable.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    unique("workspace_member_project_workspace_user_project_unique").on(
      table.workspaceId,
      table.userId,
      table.projectId,
    ),
    index("workspace_member_project_projectId_idx").on(table.projectId),
  ],
);

export const columnTable = pgTable(
  "column",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
    icon: text("icon"),
    color: text("color"),
    isFinal: boolean("is_final").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("column_projectId_idx").on(table.projectId)],
);

export const workflowRuleTable = pgTable(
  "workflow_rule",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    integrationType: text("integration_type").notNull(),
    eventType: text("event_type").notNull(),
    columnId: text("column_id")
      .notNull()
      .references(() => columnTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workflow_rule_projectId_idx").on(table.projectId),
    index("workflow_rule_columnId_idx").on(table.columnId),
  ],
);

export const taskTable = pgTable(
  "task",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    position: integer("position").default(0),
    number: integer("number").default(1),
    userId: text("assignee_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("to-do"),
    columnId: text("column_id").references(() => columnTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    priority: text("priority").default("low").notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    dueDate: timestamp("due_date", { mode: "date" }),
    // The person who created the task. Null for tasks from integrations and
    // for older tasks whose creator could not be recovered.
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    // Bumped on every status change, by every writer (see statusWrite in
    // task-change-request/apply-task-change.ts). A change request records it
    // and applies only while it is unchanged.
    statusGeneration: integer("status_generation").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_projectId_idx").on(table.projectId),
    index("task_createdBy_idx").on(table.createdBy),
    index("task_project_scheduled_id_idx")
      .on(table.projectId, table.id)
      .where(
        sql`${table.startDate} is not null or ${table.dueDate} is not null`,
      ),
    index("task_dueDate_idx").on(table.dueDate),
    index("task_assigneeId_idx").on(table.userId),
    index("task_columnId_idx").on(table.columnId),
    unique("task_project_number_unique").on(table.projectId, table.number),
  ],
);

// A request to change a task's status, or to delete it, made by someone who
// is not involved in the task. One pending request per task at most. Rows
// outlive their task (task_id becomes null) so outcomes stay readable.
export const taskChangeRequestTable = pgTable(
  "task_change_request",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    projectId: text("project_id").references(() => projectTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    taskKey: text("task_key").notNull(),
    taskTitle: text("task_title").notNull(),
    requestedBy: text("requested_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    channel: text("channel").$type<"web" | "agent">(),
    // How the requester signed in. With an API key, accept and the timeout
    // job re-check that key's current state and scope; the secret is never
    // stored. A deleted key leaves api_key_id null with auth_method kept.
    authMethod: text("auth_method").$type<
      "cookie" | "bearer" | "api_key" | "mcp"
    >(),
    apiKeyId: text("api_key_id").references(() => apikeyTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    // "status" or "delete". Text, so later kinds need no migration.
    kind: text("kind").notNull(),
    targetStatus: text("target_status"),
    baseStatus: text("base_status").notNull(),
    baseGeneration: integer("base_generation").notNull(),
    state: text("state").notNull().default("pending"),
    decidedBy: text("decided_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    decidedChannel: text("decided_channel").$type<"web" | "agent">(),
    decidedAt: timestamp("decided_at", { mode: "date" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("task_change_request_one_pending_idx")
      .on(table.taskId)
      .where(sql`${table.state} = 'pending'`),
    index("task_change_request_due_idx")
      .on(table.expiresAt)
      .where(sql`${table.state} = 'pending'`),
    index("task_change_request_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("task_change_request_requested_by_idx").on(
      table.requestedBy,
      table.createdAt,
    ),
    index("task_change_request_task_idx").on(table.taskId),
  ],
);

export const jobLeaseTable = pgTable("job_lease", {
  name: text("name").primaryKey(),
  owner: text("owner").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
});

export const taskReminderSentTable = pgTable(
  "task_reminder_sent",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    reminderType: text("reminder_type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_reminder_sent_taskId_idx").on(table.taskId),
    unique("task_reminder_sent_task_type_unique").on(
      table.taskId,
      table.reminderType,
    ),
  ],
);

export const activityTable = pgTable(
  "activity",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    content: text("content"),
    eventData: jsonb("event_data"),
    // How the person acted: "web" (session cookie) or "agent" (API key or
    // bearer token). Null for system events and older activity.
    channel: text("channel").$type<"web" | "agent">(),
    externalUserName: text("external_user_name"),
    externalUserAvatar: text("external_user_avatar"),
    externalSource: text("external_source"),
    externalUrl: text("external_url"),
  },
  (table) => [
    index("activity_task_id_idx").on(table.taskId),
    index("activity_userId_idx").on(table.userId),
    index("activity_createdAt_idx").on(table.createdAt),
    unique("activity_task_external_source_external_url_unique").on(
      table.taskId,
      table.externalSource,
      table.externalUrl,
    ),
  ],
);

export const assetTable = pgTable(
  "asset",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    activityId: text("activity_id").references(() => activityTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    objectKey: text("object_key").notNull().unique(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    kind: text("kind").notNull().default("image"),
    surface: text("surface").notNull().default("description"),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("asset_workspaceId_idx").on(table.workspaceId),
    index("asset_projectId_idx").on(table.projectId),
    index("asset_taskId_idx").on(table.taskId),
    index("asset_activityId_idx").on(table.activityId),
    index("asset_createdBy_idx").on(table.createdBy),
    index("asset_draft_expiry_idx")
      .on(table.createdAt, table.id)
      .where(
        sql`${table.taskId} is null and ${table.surface} in ('draft', 'draft-pending')`,
      ),
  ],
);

export const labelTable = pgTable(
  "label",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
    deletionStartedAt: timestamp("deletion_started_at", { mode: "date" }),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    workspaceId: text("workspace_id").references(() => workspaceTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    index("label_task_id_idx").on(table.taskId),
    index("label_workspace_id_idx").on(table.workspaceId),
    index("label_workspace_cascade_idx")
      .on(table.workspaceId, table.name, table.createdAt, table.id)
      .where(sql`${table.taskId} is not null`),
    unique("label_task_name_unique").on(table.taskId, table.name),
    uniqueIndex("label_workspace_name_unique")
      .on(table.workspaceId, table.name)
      .where(sql`${table.taskId} is null`),
  ],
);

export const notificationTable = pgTable(
  "notification",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    title: text("title"),
    content: text("content"),
    type: text("type").notNull().default("info"),
    eventData: jsonb("event_data"),
    isRead: boolean("is_read").default(false),
    resourceId: text("resource_id"),
    resourceType: text("resource_type"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("notification_userId_idx").on(table.userId)],
);

export const userNotificationPreferenceTable = pgTable(
  "user_notification_preference",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    emailEnabled: boolean("email_enabled").default(false).notNull(),
    ntfyEnabled: boolean("ntfy_enabled").default(false).notNull(),
    ntfyServerUrl: text("ntfy_server_url"),
    ntfyTopic: text("ntfy_topic"),
    ntfyToken: text("ntfy_token"),
    gotifyEnabled: boolean("gotify_enabled").default(false).notNull(),
    gotifyServerUrl: text("gotify_server_url"),
    gotifyToken: text("gotify_token"),
    webhookEnabled: boolean("webhook_enabled").default(false).notNull(),
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    taskAssignmentEnabled: boolean("task_assignment_enabled")
      .default(true)
      .notNull(),
    taskCommentEnabled: boolean("task_comment_enabled").default(true).notNull(),
    taskStatusChangeEnabled: boolean("task_status_change_enabled")
      .default(true)
      .notNull(),
    dueDateReminderEnabled: boolean("due_date_reminder_enabled")
      .default(true)
      .notNull(),
    dueDateReminderLeadTimeMinutes: integer(
      "due_date_reminder_lead_time_minutes",
    )
      .default(1440)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
);

export const userNotificationWorkspaceRuleTable = pgTable(
  "user_notification_workspace_rule",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    isActive: boolean("is_active").default(true).notNull(),
    emailEnabled: boolean("email_enabled").default(false).notNull(),
    ntfyEnabled: boolean("ntfy_enabled").default(false).notNull(),
    gotifyEnabled: boolean("gotify_enabled").default(false).notNull(),
    webhookEnabled: boolean("webhook_enabled").default(false).notNull(),
    projectMode: text("project_mode").default("all").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_notification_workspace_rule_userId_idx").on(table.userId),
    index("user_notification_workspace_rule_workspaceId_idx").on(
      table.workspaceId,
    ),
    unique("user_notification_workspace_rule_user_workspace_unique").on(
      table.userId,
      table.workspaceId,
    ),
    unique("user_notification_workspace_rule_workspace_id_id_unique").on(
      table.workspaceId,
      table.id,
    ),
  ],
);

export const userNotificationWorkspaceProjectTable = pgTable(
  "user_notification_workspace_project",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceRuleId: text("workspace_rule_id").notNull(),
    projectId: text("project_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.workspaceRuleId],
      foreignColumns: [
        userNotificationWorkspaceRuleTable.workspaceId,
        userNotificationWorkspaceRuleTable.id,
      ],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projectTable.workspaceId, projectTable.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("user_notification_workspace_project_ruleId_idx").on(
      table.workspaceRuleId,
    ),
    index("user_notification_workspace_project_projectId_idx").on(
      table.projectId,
    ),
    index("user_notification_workspace_project_workspaceId_projectId_idx").on(
      table.workspaceId,
      table.projectId,
    ),
    index("unwp_workspaceId_workspaceRuleId_idx").on(
      table.workspaceId,
      table.workspaceRuleId,
    ),
    unique("user_notification_workspace_project_rule_project_unique").on(
      table.workspaceRuleId,
      table.projectId,
    ),
  ],
);

// Legacy table: the GitHub plugin migration drops it at startup on existing
// installs, so SQL migrations must not touch it.
export const githubIntegrationTable = pgTable("github_integration", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .unique(),
  repositoryOwner: text("repository_owner").notNull(),
  repositoryName: text("repository_name").notNull(),
  installationId: integer("installation_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const integrationTable = pgTable(
  "integration",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").notNull(),
    config: text("config").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("integration_projectId_idx").on(table.projectId),
    index("integration_type_idx").on(table.type),
    unique("integration_project_type_unique").on(table.projectId, table.type),
  ],
);

export const githubImportTable = pgTable("github_import", {
  integrationId: text("integration_id")
    .primaryKey()
    .references(() => integrationTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  runId: text("run_id")
    .notNull()
    .$defaultFn(() => createId()),
  state: jsonb("state").$type<GitHubImportState>().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .notNull()
    .$onUpdate(() => new Date()),
});

export const externalLinkTable = pgTable(
  "external_link",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    integrationId: text("integration_id").references(
      () => integrationTable.id,
      {
        onDelete: "cascade",
        onUpdate: "cascade",
      },
    ),
    resourceType: text("resource_type").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("external_link_taskId_idx").on(table.taskId),
    index("external_link_integrationId_idx").on(table.integrationId),
    index("external_link_externalId_idx").on(table.externalId),
    index("external_link_resourceType_idx").on(table.resourceType),
    index("external_link_deferred_issue_idx")
      .on(table.id)
      .where(
        sql`${table.resourceType} = 'issue' AND ${table.metadata} LIKE '%"deferredIssueEdit":%'`,
      ),
  ],
);

export const commentTable = pgTable(
  "comment",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("comment_task_idx").on(table.taskId),
    index("comment_user_idx").on(table.userId),
  ],
);

export const taskRelationTable = pgTable(
  "task_relation",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    sourceTaskId: text("source_task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    targetTaskId: text("target_task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    relationType: text("relation_type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("task_relation_source_idx").on(table.sourceTaskId),
    index("task_relation_target_idx").on(table.targetTaskId),
  ],
);

export const apikeyTable = pgTable(
  "apikey",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    configId: text("config_id").default("default").notNull(),
    name: text("name"),
    start: text("start"),
    referenceId: text("reference_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    prefix: text("prefix"),
    key: text("key").notNull(),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "cascade",
    }),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { mode: "date" }),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_configId_idx").on(table.configId),
    index("apikey_key_idx").on(table.key),
    index("apikey_referenceId_idx").on(table.referenceId),
    index("apikey_userId_idx").on(table.userId),
  ],
);

export const mcpOauthStateTable = pgTable(
  "mcp_oauth_state",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    payload: jsonb("payload").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("mcp_oauth_state_kind_key_uidx").on(table.kind, table.key),
    index("mcp_oauth_state_expiresAt_idx").on(table.expiresAt),
  ],
);

// One row per connected MCP agent: the user approved this client once on the
// consent page. Tokens hang off the grant, so revoking it ends them all.
export const mcpGrantTable = pgTable(
  "mcp_grant",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    clientName: text("client_name").notNull(),
    resource: text("resource").notNull(),
    defaultWorkspaceId: text("default_workspace_id").references(
      () => workspaceTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
  },
  (table) => [index("mcp_grant_userId_idx").on(table.userId)],
);

// Only SHA-256 hashes of tokens are stored. A rotated refresh token is kept
// for a while so a late reuse can be told apart from an unknown token.
export const mcpTokenTable = pgTable(
  "mcp_token",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    grantId: text("grant_id")
      .notNull()
      .references(() => mcpGrantTable.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"access" | "refresh">().notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    rotatedAt: timestamp("rotated_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    uniqueIndex("mcp_token_tokenHash_uidx").on(table.tokenHash),
    // Serves the grant FK and the per-grant expired-row cleanup.
    index("mcp_token_grantId_expiresAt_idx").on(table.grantId, table.expiresAt),
  ],
);

// Auth-schema compatible aliases in schema.ts
export const user = userTable;
export const session = sessionTable;
export const account = accountTable;
export const verification = verificationTable;
export const workspace = workspaceTable;
export const team = teamTable;
export const teamMember = teamMemberTable;
export const workspace_member = workspaceUserTable;
export const invitation = invitationTable;
export const organizationRole = workspaceRoleTable;
export const apikey = apikeyTable;
// Auth-schema compatible relation exports in schema.ts
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  teamMembers: many(teamMember),
  workspace_members: many(workspace_member),
  invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const workspaceRelations = relations(workspace, ({ many }) => ({
  teams: many(team),
  workspace_members: many(workspace_member),
  invitations: many(invitation),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [team.workspaceId],
    references: [workspace.id],
  }),
  teamMembers: many(teamMember),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, {
    fields: [teamMember.teamId],
    references: [team.id],
  }),
  user: one(user, {
    fields: [teamMember.userId],
    references: [user.id],
  }),
}));

export const workspace_memberRelations = relations(
  workspace_member,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [workspace_member.workspaceId],
      references: [workspace.id],
    }),
    user: one(user, {
      fields: [workspace_member.userId],
      references: [user.id],
    }),
  }),
);

export const invitationRelations = relations(invitation, ({ one }) => ({
  workspace: one(workspace, {
    fields: [invitation.workspaceId],
    references: [workspace.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const organizationRoleRelations = relations(
  organizationRole,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [organizationRole.workspaceId],
      references: [workspace.id],
    }),
  }),
);

// These records outlive their original owner so failed object deletion can retry.
export const storageCleanupTable = pgTable("storage_cleanup", {
  objectKey: text("object_key").primaryKey(),
  lastAttemptAt: timestamp("last_attempt_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

export const dataMigrationTable = pgTable("data_migration", {
  id: text("id").primaryKey(),
  completedAt: timestamp("completed_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});
