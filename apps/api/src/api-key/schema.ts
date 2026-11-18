import { z } from "@hono/zod-openapi";

const DAY = 86_400;
export const MAX_METADATA_BYTES = 2048;

/**
 * What the web sends today. No `permissions`, rate limits or `userId`: the
 * plugin never let a client set them, and unknown fields are refused.
 */
export const createApiKeyBody = z
  .object({
    name: z.string().min(1).max(32).optional(),
    expiresIn: z
      .number()
      .int()
      .min(DAY)
      .max(365 * DAY)
      .nullable()
      .optional()
      .openapi({
        description:
          "Seconds until the key expires, from one day to 365 days. Null or absent: never.",
      }),
    prefix: z.string().min(1).max(32).optional().openapi({
      description: "Put in front of the generated secret.",
    }),
    metadata: z
      .record(z.string(), z.unknown())
      .refine(
        (value) =>
          Buffer.byteLength(JSON.stringify(value)) <= MAX_METADATA_BYTES,
        { message: `At most ${MAX_METADATA_BYTES} bytes as JSON` },
      )
      .optional()
      .openapi({ description: "A JSON object of at most 2 KB." }),
  })
  .strict()
  .openapi("CreateApiKeyBody");

export const apiKeyIdParam = z.object({ id: z.string().min(1) });
