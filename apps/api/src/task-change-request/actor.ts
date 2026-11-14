import type { Context } from "hono";
import type { PermissionMap } from "../utils/role-permissions";
import {
  type AuthMethod,
  type Channel,
  channelFor,
} from "../utils/request-channel";

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
  /** How the person signed in; stored on a request for later re-checks. */
  authMethod: AuthMethod | null;
  /** The API key used, if any. Never the secret. */
  apiKeyId: string | null;
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
  options: {
    channel?: Channel | null;
    scope?: PermissionMap | null;
    authMethod?: AuthMethod | null;
    apiKeyId?: string | null;
  } = {},
): PersonActor {
  return {
    kind: "person",
    userId,
    channel: options.channel ?? null,
    scope: options.scope ?? null,
    authMethod: options.authMethod ?? null,
    apiKeyId: options.apiKeyId ?? null,
  };
}

export function actorFromContext(c: Context): PersonActor {
  const apiKey = c.get("apiKey") as
    | { id?: string; permissions?: PermissionMap | null }
    | undefined;
  const authMethod = (c.get("authMethod") as AuthMethod | undefined) ?? null;
  return personActor(c.get("userId") as string, {
    channel: channelFor(authMethod ?? undefined),
    scope: apiKey?.permissions ?? null,
    authMethod,
    apiKeyId: authMethod === "api_key" ? (apiKey?.id ?? null) : null,
  });
}

export function actorUserId(actor: TaskActor) {
  return actor.userId;
}
