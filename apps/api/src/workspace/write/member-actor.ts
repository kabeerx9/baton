import type { Context } from "hono";
import type { WorkspaceActor } from "./workspace-actor";

/** The member actor of a request, from primitives only. */
export function memberActor(
  c: Context,
): Extract<WorkspaceActor, { kind: "member" }> {
  return {
    kind: "member",
    userId: c.get("userId"),
    authMethod: c.get("authMethod"),
    apiKeyId: c.get("apiKey")?.id ?? null,
  };
}
