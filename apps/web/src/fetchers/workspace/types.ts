import type { client } from "@baton/libs";
import type { InferResponseType } from "hono/client";

/** `GET /api/workspace/{id}`: the workspace and the caller's role in it. */
export type Workspace = InferResponseType<
  (typeof client.workspace)[":workspaceId"]["$get"],
  200
>;

// TODO(p3-api): switch to client type. P3 adds `joinedAt` to
// `GET /api/workspace/{id}/members`; until then it may be missing.
/** One member, flat: `id` is the user's id, not a member row id. */
export type WorkspaceMember = InferResponseType<
  (typeof client.workspace)[":workspaceId"]["members"]["$get"],
  200
>[number] & { joinedAt?: string };

// TODO(p3-api): switch to client type (`GET /api/workspace/{id}/roles`).
export type WorkspaceRole = {
  id: string;
  workspaceId: string;
  role: string;
  permission: Record<string, string[]>;
  createdAt: string;
  updatedAt?: string | null;
};
