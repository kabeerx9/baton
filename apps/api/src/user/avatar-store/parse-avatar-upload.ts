import { HTTPException } from "hono/http-exception";
import { decodeAvatarUpload } from "../avatar";

/** Decode an upload before any transaction opens; a bad image is a 400. */
export function parseAvatarUpload(input: {
  contentType: string;
  data: string;
}) {
  try {
    return decodeAvatarUpload(input);
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid avatar upload",
    });
  }
}
