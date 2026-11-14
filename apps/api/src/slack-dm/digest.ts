import { sql } from "drizzle-orm";
import db from "../database";
import { slackUserLinkTable } from "../database/schema";
import { slackConfig } from "./config";
import { digestMessage } from "./messages";
import { sendDm } from "./send-dm";
import { openBlockingLinks } from "./task-facts";

/** YYYY-MM-DD in the team's timezone. */
export function localDay(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/**
 * Marks today's digest as sent for one user. Returns false when it was
 * already sent today, so a restart or a second server cannot send it twice.
 */
async function claimDigest(userId: string, day: string) {
  const claimed = await db
    .insert(slackUserLinkTable)
    .values({ userId, lastDigestDay: day })
    .onConflictDoUpdate({
      target: slackUserLinkTable.userId,
      set: { lastDigestDay: day },
      setWhere: sql`${slackUserLinkTable.lastDigestDay} is distinct from ${day}`,
    })
    .returning({ userId: slackUserLinkTable.userId });
  return claimed.length > 0;
}

/**
 * The morning digest: each person whose open tasks block someone's open work
 * gets one message listing them. A person who blocks nothing gets nothing.
 */
export async function sendMorningDigests(now = new Date()) {
  const config = slackConfig();
  if (!config) return { sent: 0 };

  const byOwner = new Map<
    string,
    Awaited<ReturnType<typeof openBlockingLinks>>
  >();
  for (const link of await openBlockingLinks(config.clientUrl)) {
    const ownerId = link.blocker.ownerId;
    // Blocking your own task is not something to be reminded of.
    if (!ownerId || ownerId === link.blocked.ownerId) continue;
    byOwner.set(ownerId, [...(byOwner.get(ownerId) ?? []), link]);
  }

  const day = localDay(now, config.digestTimezone);
  let sent = 0;
  for (const [ownerId, links] of byOwner) {
    if (!(await claimDigest(ownerId, day))) continue;
    const outcome = await sendDm(
      ownerId,
      digestMessage(
        links.map((link) => ({
          blocker: link.blocker,
          blocked: link.blocked,
          waiterName: link.blocked.ownerName,
        })),
        `${config.clientUrl}/dashboard/workspace/${links[0]?.blocker.workspaceId}/my-tasks`,
      ),
    );
    if (outcome === "sent") sent += 1;
  }
  return { sent };
}
