import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { userTable } from "../../database/schema";

/** Stores the caller's zone as sent. Last write wins; no event, nobody else reads it live. */
export async function setTimeZone(userId: string, timeZone: string) {
  const [row] = await db
    .update(userTable)
    .set({ timeZone })
    .where(eq(userTable.id, userId))
    .returning({ timeZone: userTable.timeZone });
  if (!row?.timeZone) {
    throw new HTTPException(404, { message: "User not found" });
  }
  return { timeZone: row.timeZone };
}

export default setTimeZone;
