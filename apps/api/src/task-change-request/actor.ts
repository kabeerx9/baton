import type { Context } from "hono";
import type { PermissionMap } from "../utils/role-permissions";
import { type Channel, channelFor } from "../utils/request-channel";

/**
 * Who is changing a task. A person passes the consent rules; a system writer
 * (integration sync, scheduler) skips consent only, never the domain rules.
 */
export type PersonActor = {
  kind: "person";
  userId: string;
  channel: Channel | null;
  /** The API key's permissions, when the request used one. */
  scope: PermissionMap | null;
};

export type TaskActor =
  | PersonActor
  | {
      kind: "system";
      /** The person who started the system action, if any. */
      userId: string | null;
    };

export function personActor(
  userId: string,
  options: { channel?: Channel | null; scope?: PermissionMap | null } = {},
): PersonActor {
  return {
    kind: "person",
    userId,
    channel: options.channel ?? null,
    scope: options.scope ?? null,
  };
}

export function actorFromContext(c: Context): PersonActor {
  const apiKey = c.get("apiKey") as
    | { permissions?: PermissionMap | null }
    | undefined;
  return personActor(c.get("userId") as string, {
    channel: channelFor(c.get("authMethod")),
    scope: apiKey?.permissions ?? null,
  });
}

export function actorUserId(actor: TaskActor) {
  return actor.userId;
}
