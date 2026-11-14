import type { ChangeRequestRow } from "./response";

/** Plain text for in-app notifications and Slack. No markup decisions here. */
export function describeIntent(request: ChangeRequestRow) {
  return request.kind === "delete"
    ? `delete ${request.taskKey}`
    : request.targetStatus === "archived"
      ? `archive ${request.taskKey}`
      : `move ${request.taskKey} to ${request.targetStatus}`;
}

export function requestedTitle(request: ChangeRequestRow, who: string | null) {
  return `${who ?? "Someone"} asks to ${describeIntent(request)}`;
}

export function requestedBody(
  request: ChangeRequestRow,
  appliesOnTimeout: boolean,
) {
  return appliesOnTimeout
    ? `"${request.taskTitle}": accept or reject it in Baton. It applies in about 24 hours if nobody answers.`
    : `"${request.taskTitle}": accept or reject it in Baton. It expires in about 24 hours if nobody answers.`;
}

const OUTCOME_TITLES: Record<string, string> = {
  accepted: "Your request was accepted",
  rejected: "Your request was rejected",
  cancelled: "Your request was cancelled",
  superseded: "Your request was replaced",
  expired: "Your request expired",
  applied_on_timeout: "Your request applied after 24 hours",
};

export function outcomeTitle(request: ChangeRequestRow) {
  return OUTCOME_TITLES[request.state] ?? "Your request changed";
}

export function outcomeBody(request: ChangeRequestRow) {
  const reason =
    request.state === "cancelled" && request.reason
      ? ` (${request.reason.replaceAll("_", " ")})`
      : "";
  return `Request to ${describeIntent(request)}: ${request.state.replaceAll("_", " ")}${reason}.`;
}

export function slackEscape(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
