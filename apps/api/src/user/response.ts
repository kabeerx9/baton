import { z } from "../openapi";

export const avatarSchema = z
  .object({
    id: z.string(),
    url: z.string().openapi({
      description:
        "Public URL for the stored avatar, served from /api/user/avatar/{id}.",
    }),
    size: z.number().openapi({ description: "Decoded size in bytes." }),
  })
  .openapi("UserAvatar");

export const avatarDeletedSchema = z
  .object({
    deleted: z.boolean().openapi({
      description: "False when the user had no uploaded avatar to remove.",
    }),
  })
  .openapi("UserAvatarDeleted");

export const currentUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string().nullable(),
    timeZone: z.string().nullable().openapi({
      description: "The caller's IANA time zone. Null when not set.",
    }),
  })
  .openapi("CurrentUser");

export const userTimeZoneSchema = z
  .object({
    timeZone: z.string().openapi({
      description: "The stored IANA time zone name, exactly as sent.",
      example: "Asia/Kolkata",
    }),
  })
  .openapi("UserTimeZone");
