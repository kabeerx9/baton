import * as Sentry from "@sentry/node";
import type { Context } from "hono";
import { currentRequestContext } from "./request-context";

/**
 * The one way to scope a request to a workspace: sets the Hono variable,
 * the Sentry tag and the log context together, so no path forgets one.
 */
export function setWorkspaceContext(c: Context<any>, workspaceId: string) {
  c.set("workspaceId", workspaceId);
  Sentry.setTag("workspace_id", workspaceId);
  const context = currentRequestContext();
  if (context) context.workspaceId = workspaceId;
}

/** Marks the signed-in user by id only: no email, name or IP address. */
export function setRequestUser(userId: string) {
  Sentry.setUser({ id: userId });
  const context = currentRequestContext();
  if (context) context.userId = userId;
}
