import { ApiError } from "../errors/api-error";
import type { JoinLinkState } from "./lifecycle";

export function joinLinkNotFound() {
  return new ApiError(404, {
    code: "JOIN_LINK_NOT_FOUND",
    message: "This join link does not exist.",
  });
}

const UNAVAILABLE = {
  expired: { code: "JOIN_LINK_EXPIRED", message: "This join link expired." },
  revoked: {
    code: "JOIN_LINK_REVOKED",
    message: "This join link was turned off.",
  },
  used_up: {
    code: "JOIN_LINK_USED_UP",
    message: "This join link has no uses left.",
  },
} as const;

export function joinLinkUnavailable(
  state: Exclude<JoinLinkState, { kind: "active" }>,
) {
  return new ApiError(410, UNAVAILABLE[state.kind]);
}

export function removedFromWorkspace() {
  return new ApiError(403, {
    code: "REMOVED_FROM_WORKSPACE",
    message:
      "You were removed from this workspace. Ask an admin for a new link.",
  });
}

export function memberLimitReached(limit: number) {
  return new ApiError(409, {
    code: "WORKSPACE_MEMBER_LIMIT_REACHED",
    message: `This workspace already has ${limit} members.`,
  });
}

/** A 429 that keeps `code: RATE_LIMITED` and carries `Retry-After`. */
export function rateLimited(message: string, retryAfterSeconds: number) {
  const error = new ApiError(429, { code: "RATE_LIMITED", message });
  // ApiError takes no response; the error handler copies these headers.
  (error as { res?: Response }).res = new Response(null, {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
  return error;
}
