import { isTimeZone } from "../time-zone/is-time-zone";
import { parseDigestTime } from "./digest-time";

export const DEFAULT_DIGEST_TIME = { hour: 10, minute: 0 };
export const DEFAULT_DIGEST_TIMEZONE = "Asia/Kolkata";

/**
 * Slack direct messages are optional. With no bot token every send is a
 * no-op, so the tracker works the same with or without Slack.
 */
export function slackConfig() {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) return null;
  const zone = process.env.SLACK_DIGEST_TZ?.trim();
  return {
    token,
    clientUrl: (
      process.env.BATON_CLIENT_URL || "http://localhost:5173"
    ).replace(/\/+$/, ""),
    // Local send time of the digest, in each person's own zone.
    digestTime:
      parseDigestTime(process.env.SLACK_DIGEST_TIME?.trim()) ??
      DEFAULT_DIGEST_TIME,
    // The zone for people who never set one, or whose zone is no longer valid.
    digestTimezone: isTimeZone(zone) ? zone : DEFAULT_DIGEST_TIMEZONE,
  };
}

export type SlackConfig = NonNullable<ReturnType<typeof slackConfig>>;

/** Config the digest ignores or replaces, reported once at boot. */
export function digestConfigWarnings(): string[] {
  const warnings: string[] = [];
  if (process.env.SLACK_DIGEST_CRON?.trim()) {
    warnings.push(
      "SLACK_DIGEST_CRON is ignored; set SLACK_DIGEST_TIME (HH:MM). The digest goes out Monday to Friday in each person's time zone.",
    );
  }
  const time = process.env.SLACK_DIGEST_TIME?.trim();
  if (time && !parseDigestTime(time)) {
    warnings.push(`SLACK_DIGEST_TIME "${time}" is not HH:MM; using 10:00.`);
  }
  const zone = process.env.SLACK_DIGEST_TZ?.trim();
  if (zone && !isTimeZone(zone)) {
    warnings.push(
      `SLACK_DIGEST_TZ "${zone}" is not an IANA time zone name; using ${DEFAULT_DIGEST_TIMEZONE}.`,
    );
  }
  return warnings;
}
