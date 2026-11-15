import { mcpTokenTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { ACCESS_TOKEN_TTL_SECONDS, GRANT_IDLE_MS } from "./constants";
import { hashMcpToken, newMcpToken } from "./token-secret";

export type McpTokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

/** Store the hashes of a new access and refresh token for a grant. */
export async function issueTokenPair(
  tx: DbOrTx,
  grantId: string,
  now: Date,
): Promise<McpTokenPair> {
  const accessToken = newMcpToken("access");
  const refreshToken = newMcpToken("refresh");
  await tx.insert(mcpTokenTable).values([
    {
      grantId,
      kind: "access",
      tokenHash: hashMcpToken(accessToken),
      expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000),
    },
    {
      grantId,
      kind: "refresh",
      tokenHash: hashMcpToken(refreshToken),
      // The grant's idle expiry is the real limit; this bounds row lifetime.
      expiresAt: new Date(now.getTime() + GRANT_IDLE_MS),
    },
  ]);
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}
