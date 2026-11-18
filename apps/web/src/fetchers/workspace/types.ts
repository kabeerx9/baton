import type { client } from "@baton/libs";
import type { InferResponseType } from "hono/client";

/** `GET /api/workspace/{id}`: the workspace and the caller's role in it. */
export type Workspace = InferResponseType<
  (typeof client.workspace)[":workspaceId"]["$get"],
  200
>;

/** One member, flat: `id` is the user's id, not a member row id. */
export type WorkspaceMember = InferResponseType<
  (typeof client.workspace)[":workspaceId"]["members"]["$get"],
  200
>[number];

export type WorkspaceRole = InferResponseType<
  (typeof client.workspace)[":workspaceId"]["roles"]["$get"],
  200
>[number];
