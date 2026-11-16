import { z } from "../../openapi";
import { GRANT_PAGE_DEFAULT, GRANT_PAGE_MAX } from "../grant/list-grants";

export const mcpGrantSchema = z
  .object({
    id: z.string(),
    clientName: z.string().openapi({
      description:
        "Name the agent gave when it registered. Self-reported, so show it as such.",
    }),
    workspace: z
      .object({ id: z.string(), name: z.string() })
      .nullable()
      .openapi({
        description:
          "Default workspace for the agent's board tools. Null when it has none or the caller can no longer read it.",
      }),
    createdAt: z.string().openapi({ format: "date-time" }),
    lastUsedAt: z.string().openapi({
      format: "date-time",
      description: "Last call or token refresh, updated at most once a minute.",
    }),
  })
  .openapi("McpGrant");

export const mcpGrantListSchema = z
  .object({
    grants: z.array(mcpGrantSchema),
    nextCursor: z.string().nullable().openapi({
      description:
        "Pass as `cursor` to read the next page. Null on the last page.",
    }),
  })
  .openapi("McpGrantList");

export const mcpGrantListQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(GRANT_PAGE_MAX)
    .optional()
    .openapi({
      description: `Page size, ${GRANT_PAGE_DEFAULT} by default and ${GRANT_PAGE_MAX} at most.`,
    }),
  cursor: z.string().min(1).max(512).optional().openapi({
    description: "The `nextCursor` of the previous page.",
  }),
});

export const mcpGrantParamSchema = z.object({
  id: z.string().min(1).max(128),
});
