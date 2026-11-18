/**
 * The state of a join link, derived from its row and the clock. Nothing
 * stores a status: every caller derives it here and acts only on `active`.
 */
export type JoinLinkState =
  | { kind: "active" }
  | { kind: "expired"; at: Date }
  | { kind: "revoked"; at: Date }
  | { kind: "used_up" };

export type JoinLinkStateRow = {
  revokedAt: Date | null;
  expiresAt: Date;
  maxUses: number | null;
  useCount: number;
};

/** Precedence: revoked, expired, used up, active. Expiry is inclusive. */
export function deriveLinkState(
  row: JoinLinkStateRow,
  now: Date,
): JoinLinkState {
  if (row.revokedAt) return { kind: "revoked", at: row.revokedAt };
  if (now.getTime() >= row.expiresAt.getTime())
    return { kind: "expired", at: row.expiresAt };
  if (row.maxUses !== null && row.useCount >= row.maxUses)
    return { kind: "used_up" };
  return { kind: "active" };
}
