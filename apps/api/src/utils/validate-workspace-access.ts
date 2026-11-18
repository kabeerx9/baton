import { and, eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { workspaceArchivedError } from "../workspace/archive/workspace-archived-error";
import { hasInstanceAdminRole } from "./instance-admin-role";

type ValidateWorkspaceAccessOptions = {
  notFoundMessage?: string;
  /** The caller's instance-admin answer when the request already has it. */
  instanceAdmin?: boolean;
};

async function readInstanceAdmin(userId: string) {
  const [user] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  return hasInstanceAdminRole(user?.role);
}

export async function validateWorkspaceAccess(
  userId: string,
  workspaceId: string,
  apiKeyId?: string,
  options: ValidateWorkspaceAccessOptions = {},
): Promise<void> {
  if (apiKeyId) {
    const apiKey = await db
      .select()
      .from(schema.apikeyTable)
      .where(
        and(
          eq(schema.apikeyTable.id, apiKeyId),
          or(
            eq(schema.apikeyTable.referenceId, userId),
            eq(schema.apikeyTable.userId, userId),
          ),
          eq(schema.apikeyTable.enabled, true),
        ),
      )
      .limit(1);

    if (apiKey.length === 0) {
      throw new HTTPException(403, {
        message: "Invalid API key for this workspace",
      });
    }
  }

  const notFound = () =>
    new HTTPException(404, {
      message: options.notFoundMessage ?? "Workspace not found",
    });

  const instanceAdmin =
    options.instanceAdmin ?? (await readInstanceAdmin(userId));

  // Instance administrators reach any team workspace. A demo workspace is
  // its owner's private sandbox: members only, administrators included.
  const [workspace] = instanceAdmin
    ? await db
        .select({ archivedAt: schema.workspaceTable.archivedAt })
        .from(schema.workspaceTable)
        .where(
          and(
            eq(schema.workspaceTable.id, workspaceId),
            or(
              eq(schema.workspaceTable.kind, "team"),
              eq(schema.workspaceTable.demoOwnerUserId, userId),
            ),
          ),
        )
        .limit(1)
    : await db
        .select({ archivedAt: schema.workspaceTable.archivedAt })
        .from(schema.workspaceUserTable)
        .innerJoin(
          schema.workspaceTable,
          eq(schema.workspaceTable.id, schema.workspaceUserTable.workspaceId),
        )
        .where(
          and(
            eq(schema.workspaceUserTable.userId, userId),
            eq(schema.workspaceUserTable.workspaceId, workspaceId),
          ),
        )
        .limit(1);

  if (!workspace) {
    throw notFound();
  }
  // Checked after membership so outsiders cannot learn a workspace is archived.
  // Instance administrators manage archived workspaces from the admin panel.
  if (workspace.archivedAt) {
    throw workspaceArchivedError();
  }
}
