import { and, count, eq, gt, isNull, min, sql } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceJoinLinkTable } from "../../database/schema";
import {
  encryptSecret,
  hasSecretEncryptionKey,
} from "../../notification-preferences/secrets";
import { lockWorkspaceRow } from "../../workspace/lifecycle/lock-workspace-row";
import { rateLimited } from "../errors";
import { toJoinLink } from "../response";
import { JOIN_LINK_EXPIRIES } from "../schema";
import { generateJoinToken, hashJoinToken } from "../token";

export const LINKS_PER_HOUR = 20;
const HOUR_MS = 60 * 60_000;

/**
 * Makes a new link and revokes the previous one, in one transaction. The
 * workspace row lock serializes creates, joins and workspace delete.
 */
async function createJoinLink({
  workspaceId,
  userId,
  expiresIn,
  maxUses,
}: {
  workspaceId: string;
  userId: string;
  expiresIn: keyof typeof JOIN_LINK_EXPIRIES;
  maxUses: number | null;
}) {
  const token = generateJoinToken();
  const ciphertext = hasSecretEncryptionKey()
    ? (encryptSecret(token) ?? null)
    : null;

  const row = await db.transaction(async (tx) => {
    await lockWorkspaceRow(tx, workspaceId);

    const [recent] = await tx
      .select({ total: count(), oldest: min(workspaceJoinLinkTable.createdAt) })
      .from(workspaceJoinLinkTable)
      .where(
        and(
          eq(workspaceJoinLinkTable.workspaceId, workspaceId),
          gt(
            workspaceJoinLinkTable.createdAt,
            sql`(now() AT TIME ZONE 'utc') - interval '1 hour'`,
          ),
        ),
      );
    if ((recent?.total ?? 0) >= LINKS_PER_HOUR) {
      const oldest = recent?.oldest?.getTime() ?? Date.now();
      throw rateLimited(
        `A workspace can create at most ${LINKS_PER_HOUR} join links per hour. Try again later.`,
        Math.ceil((oldest + HOUR_MS - Date.now()) / 1000),
      );
    }

    await tx
      .update(workspaceJoinLinkTable)
      .set({
        revokedAt: sql`(now() AT TIME ZONE 'utc')`,
        revokedBy: userId,
        tokenCiphertext: null,
      })
      .where(
        and(
          eq(workspaceJoinLinkTable.workspaceId, workspaceId),
          isNull(workspaceJoinLinkTable.revokedAt),
        ),
      );

    const [inserted] = await tx
      .insert(workspaceJoinLinkTable)
      .values({
        workspaceId,
        tokenHash: hashJoinToken(token),
        tokenCiphertext: ciphertext,
        role: "member",
        maxUses,
        expiresAt: new Date(Date.now() + JOIN_LINK_EXPIRIES[expiresIn]),
        createdBy: userId,
      })
      .returning();
    return inserted!;
  });

  const [creator] = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  const link = toJoinLink(row, creator ?? null, new Date(), { token });
  if (!link) throw new Error("A new join link must not be revoked");
  return { link };
}

export default createJoinLink;
