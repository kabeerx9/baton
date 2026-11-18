import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNotNull, lt, or } from "drizzle-orm";
import db from "../database";
import {
  mcpGrantTable,
  mcpOauthStateTable,
  userTable,
} from "../database/schema";
import { identity } from "../identity";
import type { DbOrTx } from "../project-access/db-or-tx";
import { notBannedCondition } from "../utils/user-ban";
import { DEAD_GRANT_RETENTION_MS, GRANT_IDLE_MS } from "./grant/constants";
import { issueTokenPair, type McpTokenPair } from "./grant/issue-tokens";
import { consumeState, getState, putState } from "./oauth-store";
import { mcpResource } from "./urls";

type RegisteredClient = {
  clientId: string;
  redirectUris: string[];
  clientName?: string;
  issuedAt: number;
};

type AuthCode = {
  clientId: string;
  userId: string;
  sessionId: string;
  codeChallenge: string;
  redirectUri: string;
  /** Chosen on the consent page; null lets the tools fall back. */
  defaultWorkspaceId?: string | null;
  /**
   * The provider's credential generation at consent, null without a password.
   * Any password change bumps it, which voids the code. No clocks involved.
   */
  credentialGeneration?: number | null;
};

export type AuthorizationRequest = {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  state?: string;
};

// A grant keeps its client row alive (keepClientAlive); this TTL only bounds
// registrations that never complete a sign-in.
const clientTtlMs = 30 * 24 * 60 * 60 * 1000;
const codeTtlMs = 5 * 60 * 1000;
const requestTtlMs = 10 * 60 * 1000;

export async function getClient(
  clientId: string,
): Promise<RegisteredClient | null> {
  return getState<RegisteredClient>("client", clientId);
}

export async function registerClient(params: {
  redirectUris: string[];
  clientName?: string;
}): Promise<RegisteredClient> {
  const clientId = randomUUID();
  const client: RegisteredClient = {
    clientId,
    redirectUris: [...params.redirectUris],
    clientName: params.clientName,
    issuedAt: Math.floor(Date.now() / 1000),
  };
  await putState(
    "client",
    clientId,
    client,
    new Date(Date.now() + clientTtlMs),
  );
  return client;
}

export async function createAuthCode(
  params: Omit<AuthCode, "credentialGeneration">,
  requestId?: string,
): Promise<string> {
  const code = randomUUID();
  await putState(
    "code",
    code,
    {
      ...params,
      // Unfenced read: redemption compares it again under the user lock.
      credentialGeneration: await identity.fence.credentialGeneration(
        db,
        params.userId,
      ),
    } satisfies AuthCode,
    new Date(Date.now() + codeTtlMs),
    requestId,
  );
  return code;
}

export async function createAuthorizationRequest(
  params: AuthorizationRequest,
): Promise<string> {
  const requestId = randomUUID();
  await putState(
    "request",
    requestId,
    params,
    new Date(Date.now() + requestTtlMs),
  );
  return requestId;
}

export async function getAuthorizationRequest(
  requestId: string,
): Promise<AuthorizationRequest | null> {
  return getState<AuthorizationRequest>("request", requestId);
}

export async function consumeAuthorizationRequest(
  requestId: string,
): Promise<AuthorizationRequest | null> {
  return consumeState<AuthorizationRequest>("request", requestId);
}

/** Extend a client row while a grant uses it, so reconnects keep their client_id. */
export async function keepClientAlive(
  tx: DbOrTx,
  clientId: string,
  until: Date,
): Promise<void> {
  await tx
    .update(mcpOauthStateTable)
    .set({ expiresAt: until })
    .where(
      and(
        eq(mcpOauthStateTable.kind, "client"),
        eq(mcpOauthStateTable.key, clientId),
        lt(mcpOauthStateTable.expiresAt, until),
      ),
    );
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const hash = createHash("sha256").update(codeVerifier).digest();
  return base64url(hash) === codeChallenge;
}

export async function exchangeCode(
  code: string,
  clientId: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<McpTokenPair | null> {
  const stored = await consumeState<AuthCode>("code", code);
  if (!stored) return null;

  if (stored.clientId !== clientId) return null;
  if (stored.redirectUri !== redirectUri) return null;
  if (!verifyPkce(codeVerifier, stored.codeChallenge)) return null;

  // Revoking the approving session must also retire its outstanding codes.
  if (!stored.sessionId) return null;
  const client = await getClient(clientId);
  return db.transaction(async (tx) => {
    // Session deletions in the auth adapter lock this user before their
    // DELETE statement, so revocation cannot miss this transaction's insert.
    const [user] = await tx
      .select({ id: userTable.id })
      .from(userTable)
      .where(and(eq(userTable.id, stored.userId), notBannedCondition()))
      .limit(1)
      .for("update");
    if (!user) return null;
    // Locks the approving session row, after the user row.
    if (
      !(await identity.fence.sessionIsLive(tx, {
        userId: stored.userId,
        sessionId: stored.sessionId,
      }))
    )
      return null;
    // An admin password reset keeps sessions, so the session check above
    // cannot catch it. Any password change since consent bumped the
    // generation. Read under the user lock that revokeUserGrants also takes.
    if (
      stored.credentialGeneration === undefined ||
      (await identity.fence.credentialGeneration(tx, stored.userId)) !==
        stored.credentialGeneration
    )
      return null;

    const now = new Date();
    // Bounded cleanup: drop this user's grants that ended long ago.
    const cutoff = new Date(now.getTime() - DEAD_GRANT_RETENTION_MS);
    await tx
      .delete(mcpGrantTable)
      .where(
        and(
          eq(mcpGrantTable.userId, stored.userId),
          or(
            and(
              isNotNull(mcpGrantTable.revokedAt),
              lt(mcpGrantTable.revokedAt, cutoff),
            ),
            lt(mcpGrantTable.idleExpiresAt, cutoff),
          ),
        ),
      );
    const idleExpiresAt = new Date(now.getTime() + GRANT_IDLE_MS);
    const [grant] = await tx
      .insert(mcpGrantTable)
      .values({
        userId: stored.userId,
        clientId,
        clientName: client?.clientName || "MCP client",
        resource: mcpResource(),
        defaultWorkspaceId: stored.defaultWorkspaceId ?? null,
        createdAt: now,
        lastUsedAt: now,
        idleExpiresAt,
      })
      .returning({ id: mcpGrantTable.id });
    if (!grant) return null;
    await keepClientAlive(tx, clientId, idleExpiresAt);
    return issueTokenPair(tx, grant.id, now);
  });
}
