import { z } from "../openapi";
import { isTimeZone } from "../time-zone/is-time-zone";
import { MAX_AVATAR_INPUT_CHARS } from "./avatar";

export const uploadAvatarBody = z.object({
  contentType: z.string().max(64).openapi({
    description: "One of image/png, image/jpeg, or image/webp.",
    example: "image/png",
  }),
  data: z
    .string()
    .max(MAX_AVATAR_INPUT_CHARS)
    .openapi({ description: "Base64 encoded image bytes." }),
});

export const userSessionParam = z.object({
  sessionId: z.string().min(1).max(200),
});

export const setTimeZoneBody = z.object({
  timeZone: z
    .string()
    .max(64)
    .refine(isTimeZone, "Not an IANA time zone name")
    .openapi({
      description:
        "An IANA time zone name such as Asia/Kolkata or UTC. Abbreviations (IST) and offsets (+05:30) are rejected. Stored exactly as sent.",
      example: "Asia/Kolkata",
    }),
});
