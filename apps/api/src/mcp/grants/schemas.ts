import { z } from "../../openapi";

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
          "Default workspace for the agent's board tools, or null when it has none.",
      }),
    createdAt: z.string().openapi({ format: "date-time" }),
    lastUsedAt: z.string().openapi({
      format: "date-time",
      description: "Last call or token refresh, updated at most once a minute.",
    }),
  })
  .openapi("McpGrant");

export const mcpGrantListSchema = z.array(mcpGrantSchema);

export const mcpGrantParamSchema = z.object({
  id: z.string().min(1).max(128),
});
