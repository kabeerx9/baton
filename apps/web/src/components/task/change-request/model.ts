import type { Decision } from "@/fetchers/task-change-request/decide-change-request";

type Channel = "web" | "agent" | null;

/** The request as the banner needs it. The summary is always there; the detail adds the rest. */
export type BannerRequest = {
  id: string;
  kind: string;
  targetStatus: string | null;
  baseStatus: string | null;
  requestedBy: string | null;
  channel: Channel;
  createdAt: string | null;
  expiresAt: string;
};

export type BannerRole = "answer" | "cancel" | "observe";

/**
 * One value for the banner. It is derived from server data and the one
 * mutation; the component keeps no lifecycle of its own.
 */
export type BannerState =
  | { kind: "hidden" }
  | {
      kind: "open";
      role: BannerRole;
      request: BannerRequest;
      /** The decision in flight, if any. */
      sending: Decision | null;
      error: "failed" | "decided" | null;
    }
  | { kind: "closed"; state: string; request: BannerRequest | null };

export type BannerInput = {
  summary: {
    id: string;
    kind: string;
    targetStatus: string | null;
    requestedBy: string | null;
    channel: Channel;
    expiresAt: string;
  } | null;
  detail:
    | (Omit<BannerRequest, "baseStatus" | "createdAt"> & {
        baseStatus: string;
        createdAt: string;
        state: string;
      })
    | undefined;
  canAnswer: boolean;
  userId: string | undefined;
  mutation: {
    status: "idle" | "pending" | "success" | "error";
    requestId: string | undefined;
    decision: Decision | undefined;
    /** The state the server recorded after a successful decision. */
    resultState: string | undefined;
    errorStatus: number | undefined;
  };
};

/** Any state but "pending" is final, and so is one this client does not know. */
export function isOpen(state: string) {
  return state === "pending";
}

export function deriveBanner({
  summary,
  detail,
  canAnswer,
  userId,
  mutation,
}: BannerInput): BannerState {
  const activeId = summary?.id ?? mutation.requestId;
  const detailHere = detail && detail.id === activeId ? detail : undefined;
  const request: BannerRequest | null = summary
    ? {
        ...summary,
        baseStatus: detailHere?.baseStatus ?? null,
        createdAt: detailHere?.createdAt ?? null,
      }
    : (detailHere ?? null);

  const mine = mutation.requestId === activeId;
  const closedState =
    mine && mutation.status === "success"
      ? mutation.resultState
      : detailHere && !isOpen(detailHere.state)
        ? detailHere.state
        : undefined;
  if (closedState !== undefined) {
    return { kind: "closed", state: closedState, request };
  }
  if (!summary || !request) return { kind: "hidden" };

  const role: BannerRole =
    userId && summary.requestedBy === userId
      ? "cancel"
      : canAnswer
        ? "answer"
        : "observe";
  return {
    kind: "open",
    role,
    request,
    sending:
      mine && mutation.status === "pending"
        ? (mutation.decision ?? null)
        : null,
    error:
      mine && mutation.status === "error"
        ? mutation.errorStatus === 409
          ? "decided"
          : "failed"
        : null,
  };
}

/** Whole hours left, never below 1: an overdue request is closed by the hourly check soon. */
export function hoursLeft(expiresAt: string, now: number) {
  return Math.max(
    1,
    Math.round((new Date(expiresAt).getTime() - now) / 3_600_000),
  );
}

/** An unanswered status request applies after the wait unless it targets a final column. */
export function appliesOnTimeout(
  request: Pick<BannerRequest, "kind" | "targetStatus">,
  finalSlugs: ReadonlySet<string> | undefined,
) {
  return (
    request.kind === "status" &&
    request.targetStatus !== null &&
    request.targetStatus !== "archived" &&
    finalSlugs !== undefined &&
    !finalSlugs.has(request.targetStatus)
  );
}
