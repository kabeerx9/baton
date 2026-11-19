import { eq } from "drizzle-orm";
import db from "../database";
import { slackUserLinkTable, userTable } from "../database/schema";
import { lookupSlackUserByEmail } from "./slack-api";
import { logger } from "../observability/logger";

// A person not found in Slack is looked up again after a day, in case they
// joined or changed their email.
const RETRY_NOT_FOUND_MS = 24 * 60 * 60 * 1000;

/**
 * The Slack user id for a tracker user, or null when they have none.
 * A manual link always wins. Otherwise the user's email is looked up in
 * Slack once and the answer is saved.
 */
export async function resolveSlackUser(
  token: string,
  userId: string,
): Promise<string | null> {
  const [link] = await db
    .select()
    .from(slackUserLinkTable)
    .where(eq(slackUserLinkTable.userId, userId))
    .limit(1);

  if (link?.source === "manual") return link.slackUserId;
  if (link?.slackUserId) return link.slackUserId;
  if (
    link?.checkedAt &&
    Date.now() - link.checkedAt.getTime() < RETRY_NOT_FOUND_MS
  ) {
    return null;
  }

  const [user] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!user) return null;

  const result = await lookupSlackUserByEmail(token, user.email);
  // A failed call says nothing about the person. Do not save it; try again
  // on the next message.
  if (result.kind === "error") {
    logger.error(`[slack-dm] lookup failed: ${result.error}`);
    return null;
  }
  const slackUserId = result.kind === "found" ? result.slackUserId : null;
  await db
    .insert(slackUserLinkTable)
    .values({ userId, slackUserId, source: "email", checkedAt: new Date() })
    .onConflictDoUpdate({
      target: slackUserLinkTable.userId,
      set: { slackUserId, source: "email", checkedAt: new Date() },
    });
  return slackUserId;
}
