import db from "../database";
import { userTable } from "../database/schema";
import { isTimeZone } from "../time-zone/is-time-zone";
import { claimDigest } from "./claim-digest";
import { type SlackConfig, slackConfig } from "./config";
import { digestDueDay } from "./digest-due";
import { digestMessage } from "./messages";
import { sendDm } from "./send-dm";
import { type DueZone, dueBlockingLinks } from "./task-facts";

/** The stored zones whose digest is due at `now`, each with its local day. */
async function dueZones(now: Date, config: SlackConfig): Promise<DueZone[]> {
  const zones = await db
    .selectDistinct({ stored: userTable.timeZone })
    .from(userTable);
  return zones.flatMap(({ stored }) => {
    const effective = isTimeZone(stored) ? stored : config.digestTimezone;
    const day = digestDueDay(now, effective, config.digestTime);
    return day ? [{ stored, day }] : [];
  });
}

/**
 * The "Waiting on you" digest, run every 15 minutes. Each person whose open
 * tasks block someone's open work gets one message on a local weekday at
 * SLACK_DIGEST_TIME in their own zone. A person who blocks nothing gets nothing.
 */
export async function sendDueDigests(now = new Date()) {
  const config = slackConfig();
  if (!config) return { sent: 0 };

  // Most ticks end here: one small query, no zone is due.
  const due = await dueZones(now, config);
  if (due.length === 0) return { sent: 0 };

  const byOwner = new Map<
    string,
    Awaited<ReturnType<typeof dueBlockingLinks>>
  >();
  for (const link of await dueBlockingLinks(config.clientUrl, due)) {
    const ownerId = link.blocker.ownerId;
    // Blocking your own task is not something to be reminded of.
    if (!ownerId || ownerId === link.blocked.ownerId) continue;
    byOwner.set(ownerId, [...(byOwner.get(ownerId) ?? []), link]);
  }

  let sent = 0;
  for (const [ownerId, links] of byOwner) {
    const first = links[0];
    if (!first || !(await claimDigest(ownerId, first.day, first.zone)))
      continue;
    const outcome = await sendDm(
      ownerId,
      digestMessage(
        links.map((link) => ({
          blocker: link.blocker,
          blocked: link.blocked,
          waiterName: link.blocked.ownerName,
        })),
        `${config.clientUrl}/dashboard/workspace/${first.blocker.workspaceId}/my-tasks`,
      ),
      // dueBlockingLinks lists team workspaces only; the guard still checks.
      { workspaceId: first.blocker.workspaceId },
    );
    if (outcome === "sent") sent += 1;
  }
  return { sent };
}
