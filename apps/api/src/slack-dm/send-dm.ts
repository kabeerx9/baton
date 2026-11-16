import { isDemoWorkspace } from "../workspace/kind/is-demo-workspace";
import { slackConfig } from "./config";
import { resolveSlackUser } from "./resolve-slack-user";
import { postSlackDm } from "./slack-api";

export type SendOutcome =
  | "sent"
  | "slack_not_configured"
  | "no_slack_user"
  | "failed";

/**
 * What a message is about. A workspace message is checked against the
 * side-effect guard; only a message about no workspace (the test message)
 * skips it. Required, so a new caller cannot forget the guard.
 */
export type DmScope = { workspaceId: string } | { personal: true };

export type WorkspaceSendOutcome = SendOutcome | "skipped_demo_workspace";

/**
 * Sends one direct message to a tracker user. It never throws: a Slack
 * problem is logged and reported as an outcome, and the task change that
 * caused the message has already succeeded.
 */
export async function sendDm(
  userId: string,
  text: string,
  scope: { personal: true },
): Promise<SendOutcome>;
export async function sendDm(
  userId: string,
  text: string,
  scope: { workspaceId: string },
): Promise<WorkspaceSendOutcome>;
export async function sendDm(
  userId: string,
  text: string,
  scope: DmScope,
): Promise<WorkspaceSendOutcome> {
  const config = slackConfig();
  if (!config) return "slack_not_configured";
  try {
    // A demo workspace is a private sandbox: nothing about it leaves Baton.
    if ("workspaceId" in scope && (await isDemoWorkspace(scope.workspaceId)))
      return "skipped_demo_workspace";
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
