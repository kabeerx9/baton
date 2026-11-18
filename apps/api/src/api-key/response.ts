import { z } from "@hono/zod-openapi";

const permissions = z.record(z.string(), z.array(z.string())).nullable();

/** A key as its owner sees it: never the secret or its hash. */
export const apiKeySchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    start: z.string().nullable().openapi({
      description: "The first six characters of the secret, prefix included.",
    }),
    prefix: z.string().nullable(),
    enabled: z.boolean(),
    expiresAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    lastRequest: z.string().nullable(),
    rateLimitEnabled: z.boolean(),
    rateLimitMax: z.number().nullable(),
    rateLimitTimeWindow: z.number().nullable(),
    remaining: z.number().nullable(),
    permissions: permissions.openapi({
      description: "The key's scope; null means the owner's full rights.",
    }),
    metadata: z.record(z.string(), z.unknown()).nullable(),
  })
  .openapi("ApiKey");

export const apiKeyListSchema = z.array(apiKeySchema).openapi("ApiKeyList");

export const createdApiKeySchema = apiKeySchema
  .extend({
    key: z.string().openapi({
      description: "The secret. Shown in this response only.",
    }),
  })
  .openapi("CreatedApiKey");

export const deletedApiKeySchema = z
  .object({ id: z.string() })
  .openapi("DeletedApiKey");
