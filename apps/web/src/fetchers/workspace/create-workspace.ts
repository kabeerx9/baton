import { contractRequest } from "./contract-request";
import type { Workspace } from "./types";

export type CreateWorkspaceBody = { name: string; description?: string };

/** The server makes the slug and adds the caller as owner. */
// TODO(p3-api): switch to client type (`POST /api/workspace` → 201).
export function createWorkspace(body: CreateWorkspaceBody) {
  return contractRequest<Workspace>("POST", "/workspace", body);
}
