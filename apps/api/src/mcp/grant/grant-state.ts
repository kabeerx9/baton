export type GrantState =
  | { kind: "active" }
  | { kind: "revoked" }
  | { kind: "idle_expired" };

type GrantTimes = { revokedAt: Date | null; idleExpiresAt: Date };

/**
 * The one place a grant's lifecycle is derived. Anything that is not clearly
 * active (an invalid date included) is treated as ended.
 */
export function grantState(grant: GrantTimes, now: Date): GrantState {
  if (grant.revokedAt !== null) return { kind: "revoked" };
  if (!(grant.idleExpiresAt.getTime() > now.getTime())) {
    return { kind: "idle_expired" };
  }
  return { kind: "active" };
}
