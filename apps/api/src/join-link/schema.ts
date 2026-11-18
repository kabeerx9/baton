import { z } from "../openapi";

export const JOIN_LINK_EXPIRIES = {
  "30m": 30 * 60_000,
  "24h": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
} as const;

export const workspaceIdParam = z.object({
  workspaceId: z.string().min(1),
});

export const createJoinLinkBody = z
  .object({
    expiresIn: z
      .enum(["30m", "24h", "7d"])
      .default("24h")
      .openapi({ description: "How long the link works. Default 24h." }),
    maxUses: z
      .number()
      .int()
      .min(1)
      .max(10_000)
      .nullable()
      .optional()
      .openapi({ description: "How many people can join. Null: no limit." }),
  })
  .strict()
  .openapi("CreateJoinLinkBody");

// Any string: the controller answers a malformed token like an unknown one.
const tokenField = z.string().openapi({
  description: "The token from the join URL.",
});

export const previewJoinLinkBody = z
  .object({ token: tokenField })
  .openapi("PreviewJoinLinkBody");

export const joinWorkspaceBody = z
  .object({ token: tokenField })
  .strict()
  .openapi("JoinWorkspaceBody");

export const joinLinkSchema = z
  .object({
    id: z.string(),
    state: z.enum(["active", "expired", "used_up"]),
    url: z.string().nullable().openapi({
      description:
        "The link to share. Null unless the link is active and the server can read it again; the create response always has it.",
    }),
    expiresAt: z.string().openapi({ format: "date-time" }),
    createdAt: z.string().openapi({ format: "date-time" }),
    createdBy: z.object({ id: z.string(), name: z.string() }).nullable(),
    maxUses: z.number().int().nullable(),
    useCount: z.number().int(),
  })
  .openapi("JoinLink");

export const joinLinkResponse = z
  .object({ link: joinLinkSchema.nullable() })
  .openapi("JoinLinkResponse");

export const createdJoinLinkResponse = z
  .object({ link: joinLinkSchema })
  .openapi("CreatedJoinLinkResponse");

export const revokedJoinLinkResponse = z
  .object({ link: z.null() })
  .openapi("RevokedJoinLinkResponse");

export const joinLinkPreviewSchema = z
  .discriminatedUnion("status", [
    z.object({
      status: z.literal("active"),
      workspace: z.object({ name: z.string() }),
      sharedBy: z.object({ name: z.string() }).nullable(),
      expiresAt: z.string().openapi({ format: "date-time" }),
    }),
    z.object({
      status: z.literal("unavailable"),
      reason: z.enum(["expired", "revoked", "used_up", "not_found"]),
    }),
  ])
  .openapi("JoinLinkPreview");

export const joinWorkspaceResponse = z
  .object({
    outcome: z.enum(["joined", "already_member"]),
    workspace: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  })
  .openapi("JoinWorkspaceResult");

export type JoinLink = z.infer<typeof joinLinkSchema>;
export type JoinLinkPreview = z.infer<typeof joinLinkPreviewSchema>;
