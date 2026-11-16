import { eq } from "drizzle-orm";
import db from "../../database";
import { workspaceTable } from "../../database/schema";
import { toWorkspaceKind, type WorkspaceKind } from "./workspace-kind";

// A workspace never changes kind and ids are never reused, so a cached
// answer stays true. Bounded so a long-lived process cannot grow it forever.
const MAX_CACHED = 5_000;
const kinds = new Map<string, WorkspaceKind>();

async function workspaceKind(workspaceId: string): Promise<WorkspaceKind> {
  const cached = kinds.get(workspaceId);
  if (cached) return cached;
  const [row] = await db
    .select({ kind: workspaceTable.kind })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);
  // A missing workspace is not cached: it may be committing right now.
  if (!row) return "demo";
  const kind = toWorkspaceKind(row.kind);
  if (kinds.size >= MAX_CACHED) kinds.clear();
  kinds.set(workspaceId, kind);
  return kind;
}

/**
 * The side-effect guard. Every sink that sends data out of Baton (Slack,
 * email, push, user webhooks, integrations) asks this before sending. A
 * demo workspace, or one that no longer exists, sends nothing.
 */
export async function isDemoWorkspace(workspaceId: string) {
  return (await workspaceKind(workspaceId)) === "demo";
}
