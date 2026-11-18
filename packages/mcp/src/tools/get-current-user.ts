import { z } from "zod";
import type { ToolClient } from "./register.js";

const currentUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string().nullish(),
  timeZone: z.string().nullish(),
});

// /api/user/me works for API keys and MCP tokens alike; the auth API refuses
// MCP tokens.
export async function getCurrentUser(client: ToolClient) {
  const user = await client.json("/api/user/me", { method: "GET" });
  return currentUserSchema.parse(user);
}
