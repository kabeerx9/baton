import { DEFAULT_ROLE_NAMES, defaultRolePayloads } from "@baton/permissions";
import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { ApiError } from "../../errors/api-error";
import { publishEvent } from "../../events";
import { INSTANCE_SETTINGS_ID } from "../../instance-settings/read-stored-settings";
import { checkWorkspaceName } from "../../utils/check-workspace-name";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import { isBanActive } from "../../utils/user-ban";
import { SLUG_ATTEMPTS, slugFromName, slugWithSuffix } from "../workspace-slug";
import { toWorkspaceResponse } from "../to-workspace-response";

/**
 * Creation has no workspace to lock (auth-boundary §3). One transaction
 * inserts the workspace, the caller as owner and the default roles. The
 * restriction is read in that transaction, under a share lock on the
 * settings row, so a change that commits first is honoured.
 */
async function createWorkspace(input: {
  userId: string;
  name: string;
  description?: string;
}) {
  const name = input.name.trim();
  const check = checkWorkspaceName(name);
  if (!check.ok)
    throw new ApiError(400, {
      code: "INVALID_WORKSPACE_NAME",
      message: check.reason,
    });

  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        name: schema.userTable.name,
        role: schema.userTable.role,
        banned: schema.userTable.banned,
        banExpires: schema.userTable.banExpires,
      })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, input.userId))
      .limit(1);
    if (!user || isBanActive(user))
      throw new ApiError(403, {
        code: "ACCOUNT_DISABLED",
        message: "This account is deactivated.",
      });

    const [settings] = await tx
      .select({
        restricted: schema.instanceSettingsTable.workspaceCreationRestricted,
      })
      .from(schema.instanceSettingsTable)
      .where(eq(schema.instanceSettingsTable.id, INSTANCE_SETTINGS_ID))
      .limit(1)
      .for("share");
    const restricted =
      process.env.DISABLE_WORKSPACE_CREATION === "true" ||
      Boolean(settings?.restricted);
    if (restricted && !hasInstanceAdminRole(user.role))
      throw new ApiError(403, {
        code: "WORKSPACE_CREATION_RESTRICTED",
        message: "Only instance administrators can create workspaces.",
      });

    const base = slugFromName(name);
    let workspace: typeof schema.workspaceTable.$inferSelect | undefined;
    for (let attempt = 0; attempt < SLUG_ATTEMPTS && !workspace; attempt++) {
      [workspace] = await tx
        .insert(schema.workspaceTable)
        .values({
          name,
          slug: attempt === 0 ? base : slugWithSuffix(base),
          description: input.description?.trim() || null,
          createdAt: new Date(),
        })
        .onConflictDoNothing({ target: schema.workspaceTable.slug })
        .returning();
    }
    if (!workspace)
      throw new ApiError(409, {
        code: "SLUG_UNAVAILABLE",
        message: "Could not find a free address for this workspace. Try again.",
      });

    const now = new Date();
    await tx.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: input.userId,
      role: "owner",
      joinedAt: now,
    });
    await tx.insert(schema.workspaceRoleTable).values(
      DEFAULT_ROLE_NAMES.map((role) => ({
        workspaceId: workspace.id,
        role,
        permission: JSON.stringify(defaultRolePayloads[role]),
        createdAt: now,
        updatedAt: now,
      })),
    );
    return { workspace, ownerName: user.name };
  });

  await publishEvent("workspace.created", {
    workspaceId: created.workspace.id,
    workspaceName: created.workspace.name,
    ownerEmail: created.ownerName,
    ownerId: input.userId,
  });
  return toWorkspaceResponse({ ...created.workspace, role: "owner" });
}

export default createWorkspace;
