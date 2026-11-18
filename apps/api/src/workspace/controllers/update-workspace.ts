import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { ApiError } from "../../errors/api-error";
import { checkWorkspaceName } from "../../utils/check-workspace-name";
import { lockWorkspace } from "../lifecycle/lock-workspace";
import { toWorkspaceResponse } from "../to-workspace-response";
import { authorizeWorkspaceWrite } from "../write/authorize-workspace-write";
import type { WorkspaceActor } from "../write/workspace-actor";

/** Rename a workspace or change its description or logo. A demo's owner may. */
async function updateWorkspace(input: {
  workspaceId: string;
  actor: Extract<WorkspaceActor, { kind: "member" }>;
  patch: { name?: string; description?: string; logo?: string };
}) {
  const { workspaceId, actor, patch } = input;
  const name = patch.name?.trim();
  if (name !== undefined) {
    const check = checkWorkspaceName(name);
    if (!check.ok)
      throw new ApiError(400, {
        code: "INVALID_WORKSPACE_NAME",
        message: check.reason,
      });
  }

  return db.transaction(async (tx) => {
    const locked = await lockWorkspace(tx, workspaceId, { allowDemo: true });
    const member = await authorizeWorkspaceWrite(tx, locked, actor, {
      permissions: { organization: ["update"] },
    });
    const set = {
      ...(name !== undefined ? { name } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description.trim() || null }
        : {}),
      ...(patch.logo !== undefined ? { logo: patch.logo || null } : {}),
    };
    const [updated] =
      Object.keys(set).length > 0
        ? await tx
            .update(schema.workspaceTable)
            .set(set)
            .where(eq(schema.workspaceTable.id, workspaceId))
            .returning()
        : [locked.workspace];
    return toWorkspaceResponse({ ...updated!, role: member?.role ?? null });
  });
}

export default updateWorkspace;
