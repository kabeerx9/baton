import { slackConfig } from "./config";
import { resolveSlackUser } from "./resolve-slack-user";
import { postSlackDm } from "./slack-api";

export type SendOutcome =
  | "sent"
  | "slack_not_configured"
  | "no_slack_user"
  | "failed";

/**
 * Sends one direct message to a tracker user. It never throws: a Slack
 * problem is logged and reported as an outcome, and the task change that
 * caused the message has already succeeded.
 */
export async function sendDm(
  userId: string,
  text: string,
): Promise<SendOutcome> {
  const config = slackConfig();
  if (!config) return "slack_not_configured";
  try {
    const slackUserId = await resolveSlackUser(config.token, userId);
    if (!slackUserId) return "no_slack_user";
    const result = await postSlackDm(config.token, slackUserId, text);
    if (result.kind === "error") {
      console.error(`[slack-dm] send failed: ${result.error}`);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("[slack-dm] send failed", error);
    return "failed";
  }
}
