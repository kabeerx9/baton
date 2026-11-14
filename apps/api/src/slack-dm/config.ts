/**
 * Slack direct messages are optional. With no bot token every send is a
 * no-op, so the tracker works the same with or without Slack.
 */
export function slackConfig() {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) return null;
  return {
    token,
    clientUrl: (
      process.env.BATON_CLIENT_URL || "http://localhost:5173"
    ).replace(/\/+$/, ""),
    digestCron: process.env.SLACK_DIGEST_CRON?.trim() || "0 10 * * 1-5",
    digestTimezone: process.env.SLACK_DIGEST_TZ?.trim() || "Asia/Kolkata",
  };
}

export type SlackConfig = NonNullable<ReturnType<typeof slackConfig>>;
