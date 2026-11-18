import type { z } from "@hono/zod-openapi";
import type { apikeyTable } from "../database/schema";
import { parsePermissions } from "../utils/verify-api-key";
import type { apiKeySchema } from "./response";

type ApiKeyRow = typeof apikeyTable.$inferSelect;

const iso = (date: Date | null) => (date ? date.toISOString() : null);

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The public view of a key row. Leaves out `key` (the hash) by naming fields. */
export function toApiKeyView(row: ApiKeyRow): z.infer<typeof apiKeySchema> {
  return {
    id: row.id,
    name: row.name,
    start: row.start,
    prefix: row.prefix,
    enabled: row.enabled ?? true,
    expiresAt: iso(row.expiresAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastRequest: iso(row.lastRequest),
    rateLimitEnabled: row.rateLimitEnabled ?? true,
    rateLimitMax: row.rateLimitMax,
    rateLimitTimeWindow: row.rateLimitTimeWindow,
    remaining: row.remaining,
    permissions: parsePermissions(row.permissions),
    metadata: parseMetadata(row.metadata),
  };
}
