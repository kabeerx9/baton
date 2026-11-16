import type { Context, Next } from "hono";
import { ApiError } from "../../errors/api-error";
import {
  DEMO_WORKSPACE_CODE,
  DEMO_WORKSPACE_MESSAGE,
} from "./assert-shareable-workspace";
import { isDemoWorkspace } from "./is-demo-workspace";

export function demoWorkspaceError() {
  return new ApiError(403, {
    code: DEMO_WORKSPACE_CODE,
    message: DEMO_WORKSPACE_MESSAGE,
  });
}

/**
 * Route middleware, after workspace access has set `workspaceId`: refuses
 * work that would reach an outside provider from a demo workspace.
 */
export async function refuseDemoWorkspace(c: Context, next: Next) {
  const workspaceId = c.get("workspaceId") as string | undefined;
  if (!workspaceId || (await isDemoWorkspace(workspaceId)))
    throw demoWorkspaceError();
  return next();
}
