const SLACK_TIMEOUT_MS = 5000;

// Overridable so a local fake can stand in for Slack in tests.
const slackApiUrl = () =>
  (process.env.SLACK_API_URL || "https://slack.com/api").replace(/\/+$/, "");

type SlackResponse = { ok: boolean; error?: string; user?: { id?: string } };

async function slackCall(
  token: string,
  method: string,
  params: Record<string, string>,
): Promise<SlackResponse> {
  try {
    const response = await fetch(`${slackApiUrl()}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
      // The timeout is on the call: a slow Slack never holds up a task change.
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, error: `http_${response.status}` };
    return (await response.json()) as SlackResponse;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.name : "network_error",
    };
  }
}

export type LookupResult =
  | { kind: "found"; slackUserId: string }
  | { kind: "not_found" }
  | { kind: "error"; error: string };

/** Needs the `users:read.email` scope. */
export async function lookupSlackUserByEmail(
  token: string,
  email: string,
): Promise<LookupResult> {
  const result = await slackCall(token, "users.lookupByEmail", { email });
  if (result.ok && result.user?.id) {
    return { kind: "found", slackUserId: result.user.id };
  }
  if (result.error === "users_not_found") return { kind: "not_found" };
  return { kind: "error", error: result.error ?? "unknown" };
}

export type PostResult = { kind: "sent" } | { kind: "error"; error: string };

/** Posting to a user id opens the app's direct message with them. Needs `chat:write`. */
export async function postSlackDm(
  token: string,
  slackUserId: string,
  text: string,
): Promise<PostResult> {
  const result = await slackCall(token, "chat.postMessage", {
    channel: slackUserId,
    text,
    unfurl_links: "false",
  });
  return result.ok
    ? { kind: "sent" }
    : { kind: "error", error: result.error ?? "unknown" };
}
