import { REFRESH_GRACE_MS } from "./constants";
import { type GrantState, grantState } from "./grant-state";

export type RefreshDecision =
  /** The current refresh token: rotate it and issue a new pair. */
  | { kind: "rotate" }
  /** Rotated moments ago by a sibling process: issue a new pair, keep the grant. */
  | { kind: "grace" }
  /** Not usable, but not a sign of theft: answer invalid_grant. */
  | { kind: "reject"; reason: GrantState["kind"] | "token_expired" }
  /** A rotated token used after the grace window: revoke the whole grant. */
  | { kind: "revoke" };

type RefreshInput = {
  grant: { revokedAt: Date | null; idleExpiresAt: Date };
  token: { rotatedAt: Date | null; expiresAt: Date };
  now: Date;
};

/** Pure transition for a refresh attempt. Unknown or invalid times fail closed. */
export function decideRefresh({
  grant,
  token,
  now,
}: RefreshInput): RefreshDecision {
  const state = grantState(grant, now);
  if (state.kind !== "active") return { kind: "reject", reason: state.kind };
  if (!(token.expiresAt.getTime() > now.getTime())) {
    return { kind: "reject", reason: "token_expired" };
  }
  if (token.rotatedAt === null) return { kind: "rotate" };
  const sinceRotation = now.getTime() - token.rotatedAt.getTime();
  if (sinceRotation >= 0 && sinceRotation <= REFRESH_GRACE_MS) {
    return { kind: "grace" };
  }
  return { kind: "revoke" };
}
