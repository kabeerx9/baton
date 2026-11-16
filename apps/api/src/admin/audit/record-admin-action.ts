import { eq, sql } from "drizzle-orm";
import db, { schema } from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { enqueueAuditWebhooks } from "../webhooks/enqueue-audit-webhooks";
import { sanitizeAuditMetadata } from "./sanitize-audit-metadata";

const MAX_USER_AGENT_LENGTH = 512;

export type AdminActionInput = {
  actorUserId: string | null;
  /** Dotted `<area>.<verb>` name, for example `user.deleted`. */
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  /** Never put secrets, tokens, reset links, or key values here. */
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * The side-effect guard for audit webhooks: an entry about a demo workspace
 * stays in the audit log and never reaches a webhook. A workspace target
 * that cannot be read is treated as a demo, the kind that sends nothing.
 */
async function auditMayLeaveBaton(input: AdminActionInput, database: DbOrTx) {
  if (input.targetType !== "workspace" || !input.targetId) return true;
  const [workspace] = await database
    .select({ kind: schema.workspaceTable.kind })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, input.targetId))
    .limit(1);
  return workspace?.kind === "team";
}

/**
 * Append an entry to the admin audit log. Pass the transaction when the action
 * has one so the entry commits (or rolls back) with it.
 */
export async function recordAdminAction(
  input: AdminActionInput,
  database: DbOrTx = db,
): Promise<void> {
  const actorId = input.actorUserId;
  const actor = (column: "id" | "name" | "email") =>
    actorId
      ? sql`(SELECT ${sql.identifier(column)} FROM "user" WHERE "id" = ${actorId})`
      : null;
  const metadata = input.metadata
    ? (sanitizeAuditMetadata(input.metadata) as Record<string, unknown>)
    : null;

  const [entry] = await database
    .insert(schema.adminAuditLogTable)
    .values({
      // Resolved in the insert so a concurrently deleted actor yields NULL
      // instead of a foreign key error.
      actorUserId: actor("id"),
      actorName: actor("name"),
      actorEmail: actor("email"),
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      metadata,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
    })
    .returning({ id: schema.adminAuditLogTable.id });
  if (!entry) return;
  if (!(await auditMayLeaveBaton(input, database))) return;
  if (database !== db) {
    await enqueueAuditWebhooks(database, entry.id);
  } else {
    // The action already committed (for example better-auth's after hook).
    // Queue failure must not erase its audit entry or fail its response.
    try {
      await enqueueAuditWebhooks(database, entry.id);
    } catch {
      console.error("Admin audit webhook delivery could not be queued");
    }
  }
}

export default recordAdminAction;
