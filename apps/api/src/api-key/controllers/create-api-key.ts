import type { z } from "@hono/zod-openapi";
import db from "../../database";
import { apikeyTable } from "../../database/schema";
import { generateApiKey } from "../generate-api-key";
import { hashApiKey } from "../hash-api-key";
import type { createApiKeyBody } from "../schema";
import { toApiKeyView } from "../to-api-key-view";

// The plugin's limits in `identity/better-auth/auth.ts` before P4.
const RATE_LIMIT = { max: 100, timeWindow: 60_000 };

/** Store a new key for `userId` and return its secret, once. */
async function createApiKey(
  userId: string,
  input: z.infer<typeof createApiKeyBody>,
) {
  const { key, start } = generateApiKey(input.prefix);
  const now = new Date();
  const [row] = await db
    .insert(apikeyTable)
    .values({
      name: input.name ?? null,
      prefix: input.prefix ?? null,
      start,
      key: hashApiKey(key),
      referenceId: userId,
      enabled: true,
      expiresAt: input.expiresIn
        ? new Date(now.getTime() + input.expiresIn * 1000)
        : null,
      rateLimitEnabled: true,
      rateLimitMax: RATE_LIMIT.max,
      rateLimitTimeWindow: RATE_LIMIT.timeWindow,
      requestCount: 0,
      remaining: null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return { ...toApiKeyView(row!), key };
}

export default createApiKey;
