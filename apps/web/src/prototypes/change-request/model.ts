// Prototype only. Delete this folder when a variant is promoted.
export type RequestKind = "status" | "archive" | "delete";
export type Channel = "web" | "agent";
export type Viewer = "answerer" | "requester" | "observer";
export type ServerReply = "ok" | "decided" | "failed" | "hang";

export type MockRequest = {
  kind: RequestKind;
  baseStatus: string;
  targetStatus: string | null;
  requestedBy: string;
  channel: Channel;
  createdAt: number;
  expiresAt: number;
  /** The people who can answer, for the read-only notice. */
  answerer: string;
};

export type Action = "accept" | "reject" | "cancel";

/** One lifecycle for the panel. `resolved` carries the decision that ended it. */
export type Phase =
  | { kind: "idle" }
  | { kind: "submitting"; action: Action }
  | { kind: "error"; action: Action; reason: "decided" | "failed" }
  | { kind: "resolved"; action: Action };

export type PhaseEvent =
  | { type: "submit"; action: Action }
  | { type: "fail"; reason: "decided" | "failed" }
  | { type: "succeed" }
  | { type: "dismiss" }
  | { type: "reset" };

export function phaseReducer(phase: Phase, event: PhaseEvent): Phase {
  switch (event.type) {
    case "submit":
      return phase.kind === "submitting"
        ? phase
        : { kind: "submitting", action: event.action };
    case "fail":
      return phase.kind === "submitting"
        ? { kind: "error", action: phase.action, reason: event.reason }
        : phase;
    case "succeed":
      return phase.kind === "submitting"
        ? { kind: "resolved", action: phase.action }
        : phase;
    case "dismiss":
    case "reset":
      return { kind: "idle" };
  }
}

export const STATUS_LABEL: Record<string, string> = {
  todo: "Todo",
  doing: "Doing",
  review: "In review",
  done: "Done",
};

export function statusLabel(slug: string | null): string {
  return slug ? (STATUS_LABEL[slug] ?? slug) : "";
}

export function requesterName(request: MockRequest): string {
  return request.channel === "agent"
    ? `${request.requestedBy} (agent)`
    : request.requestedBy;
}

/** "Doing → Done", "Archive" or "Delete". */
export function describeChange(request: MockRequest): string {
  if (request.kind === "delete") return "Delete";
  if (request.kind === "archive") return "Archive";
  return `${statusLabel(request.baseStatus)} → ${statusLabel(request.targetStatus)}`;
}

/** A sentence for the request, from the viewer's side. */
export function describeAsk(request: MockRequest, viewer: Viewer): string {
  const who = viewer === "requester" ? "You" : requesterName(request);
  const verb = viewer === "requester" ? "asked" : "asks";
  if (request.kind === "delete") return `${who} ${verb} to delete this task`;
  if (request.kind === "archive") return `${who} ${verb} to archive this task`;
  return `${who} ${verb} to move this task from ${statusLabel(request.baseStatus)} to ${statusLabel(request.targetStatus)}`;
}

export function hoursLeft(request: MockRequest, now: number): number {
  return Math.max(1, Math.round((request.expiresAt - now) / 3_600_000));
}

/** What happens if nobody answers. A non-final status applies; the rest expire. */
export function fallbackCopy(request: MockRequest, now: number): string {
  const hours = hoursLeft(request, now);
  const when = `in about ${hours} ${hours === 1 ? "hour" : "hours"}`;
  return request.kind === "status" && request.targetStatus !== "done"
    ? `Applies ${when} if nobody answers.`
    : `Expires ${when} if nobody answers. The task stays as it is.`;
}

export function askedAgo(request: MockRequest, now: number): string {
  return formatAgo(now - request.createdAt);
}

function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

export function errorCopy(
  reason: "decided" | "failed",
  action: Action,
): string {
  if (reason === "decided") {
    return "Someone already answered this request. Dismiss to see the current state.";
  }
  return action === "cancel"
    ? "Could not cancel the request. Try again."
    : "Could not send your answer. Try again.";
}

export function resolvedCopy(action: Action, kind: RequestKind): string {
  if (action === "cancel") return "Request cancelled.";
  if (action === "reject") return "Request rejected. The task stays as it is.";
  if (kind === "delete") return "Request accepted. The task is deleted.";
  if (kind === "archive") return "Request accepted. The task is archived.";
  return "Request accepted. The status changed.";
}

export function acceptLabel(kind: RequestKind): string {
  return kind === "delete" ? "Accept and delete" : "Accept";
}

export function makeRequest(
  kind: RequestKind,
  channel: Channel,
  now: number,
): MockRequest {
  const base = {
    baseStatus: "doing",
    requestedBy: "Rohan",
    channel,
    createdAt: now - 3 * 3_600_000 - 12 * 60_000,
    expiresAt: now + 20 * 3_600_000 + 48 * 60_000,
    answerer: "Neha",
  };
  if (kind === "delete") return { ...base, kind, targetStatus: null };
  if (kind === "archive") return { ...base, kind, targetStatus: null };
  return { ...base, kind, targetStatus: "done" };
}
