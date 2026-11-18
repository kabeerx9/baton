import { eq } from "drizzle-orm";
import type { Context } from "hono";
import db from "../database";
import { userTable } from "../database/schema";
import { hasInstanceAdminRole } from "./instance-admin-role";

export { hasInstanceAdminRole };

// One role read per request, however many checks the route runs.
const answered = new WeakMap<Request, Promise<boolean>>();

async function readIsInstanceAdmin(userId: string) {
  const [row] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return hasInstanceAdminRole(row?.role);
}

/**
 * Records the role the session resolve already read, so `isInstanceAdmin`
 * reads nothing for a cookie or bearer session. API-key and MCP requests
 * still read the role once.
 */
export function primeInstanceRole(request: Request, role: string | null) {
  answered.set(request, Promise.resolve(hasInstanceAdminRole(role)));
}

export function isInstanceAdmin(c: Context): Promise<boolean> {
  const userId = c.get("userId");
  if (!userId) return Promise.resolve(false);
  const cached = answered.get(c.req.raw);
  if (cached) return cached;
  const answer = readIsInstanceAdmin(userId);
  answered.set(c.req.raw, answer);
  return answer;
}
