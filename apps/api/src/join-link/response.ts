import type { workspaceJoinLinkTable } from "../database/schema";
import {
  decryptSecret,
  hasSecretEncryptionKey,
} from "../notification-preferences/secrets";
import { deriveLinkState } from "./lifecycle";
import type { JoinLink } from "./schema";
import { joinLinkUrl } from "./token";

export type JoinLinkRow = typeof workspaceJoinLinkTable.$inferSelect;
export type JoinLinkCreator = { id: string; name: string } | null;

function readableUrl(ciphertext: string | null) {
  if (!ciphertext || !hasSecretEncryptionKey()) return null;
  try {
    const token = decryptSecret(ciphertext);
    return token ? joinLinkUrl(token) : null;
  } catch (error) {
    // A rotated or wrong key must not break the members page.
    console.error("Join link could not be decrypted:", error);
    return null;
  }
}

/**
 * The management view of a link. A revoked row is never shown: the caller
 * gets null, the same as no link. `url` is set only while the link is active.
 */
export function toJoinLink(
  row: JoinLinkRow,
  creator: JoinLinkCreator,
  now: Date,
  { token }: { token?: string } = {},
): JoinLink | null {
  const state = deriveLinkState(row, now);
  if (state.kind === "revoked") return null;
  const url =
    state.kind !== "active"
      ? null
      : token
        ? joinLinkUrl(token)
        : readableUrl(row.tokenCiphertext);
  return {
    id: row.id,
    state: state.kind,
    url,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    createdBy: creator,
    maxUses: row.maxUses,
    useCount: row.useCount,
  };
}
