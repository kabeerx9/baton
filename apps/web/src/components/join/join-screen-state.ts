import type {
  JoinLinkPreview,
  JoinLinkUnavailableReason,
} from "@/fetchers/join-link/types";

export type JoinFailureCode =
  | "REMOVED_FROM_WORKSPACE"
  | "WORKSPACE_MEMBER_LIMIT_REACHED"
  | "RATE_LIMITED"
  | "generic";

/** The one lifecycle of the join page. Everything it shows comes from this. */
export type JoinScreen =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: JoinLinkUnavailableReason }
  | { kind: "signed_out" }
  | { kind: "ready" }
  | { kind: "joining" }
  | { kind: "failed"; code: JoinFailureCode };

export type JoinInputs = {
  preview:
    | { status: "pending" }
    | { status: "error" }
    | { status: "success"; data: JoinLinkPreview };
  session: "loading" | "signed_out" | "signed_in";
  join:
    | { status: "idle" }
    | { status: "pending" }
    | { status: "error"; code: string | undefined };
  /** A sign-up round trip left an intent for this token: join without a click. */
  autoJoin: boolean;
};

const UNAVAILABLE_REASONS: readonly JoinLinkUnavailableReason[] = [
  "expired",
  "revoked",
  "used_up",
  "not_found",
];

function asReason(value: unknown): JoinLinkUnavailableReason {
  return UNAVAILABLE_REASONS.find((reason) => reason === value) ?? "not_found";
}

/**
 * Maps a failed join call to a screen. A link that died between preview and
 * join becomes the matching unavailable screen. Unknown codes are `generic`.
 */
export function screenForJoinError(code: string | undefined): JoinScreen {
  switch (code) {
    case "JOIN_LINK_EXPIRED":
      return { kind: "unavailable", reason: "expired" };
    case "JOIN_LINK_REVOKED":
      return { kind: "unavailable", reason: "revoked" };
    case "JOIN_LINK_USED_UP":
      return { kind: "unavailable", reason: "used_up" };
    case "JOIN_LINK_NOT_FOUND":
      return { kind: "unavailable", reason: "not_found" };
    case "REMOVED_FROM_WORKSPACE":
    case "WORKSPACE_MEMBER_LIMIT_REACHED":
    case "RATE_LIMITED":
      return { kind: "failed", code };
    default:
      return { kind: "failed", code: "generic" };
  }
}

/**
 * Pure. Any status, reason or code it does not know falls to `unavailable` or
 * `generic`; nothing unknown ever reaches `ready` or `joining`.
 */
export function deriveJoinScreen(input: JoinInputs): JoinScreen {
  if (input.join.status === "pending") return { kind: "joining" };
  if (input.join.status === "error") return screenForJoinError(input.join.code);

  if (input.preview.status === "pending" || input.session === "loading") {
    return { kind: "loading" };
  }
  if (input.preview.status === "error") {
    return { kind: "failed", code: "generic" };
  }

  const preview = input.preview.data;
  if (preview.status === "unavailable") {
    return { kind: "unavailable", reason: asReason(preview.reason) };
  }
  if (preview.status !== "active") {
    return { kind: "unavailable", reason: "not_found" };
  }

  if (input.session === "signed_out") return { kind: "signed_out" };
  if (input.session === "signed_in") {
    return input.autoJoin ? { kind: "joining" } : { kind: "ready" };
  }
  return { kind: "loading" };
}

/** True when the page should fire the join call by itself, once. */
export function shouldAutoJoin(input: JoinInputs): boolean {
  return (
    input.autoJoin &&
    input.join.status === "idle" &&
    deriveJoinScreen({ ...input, autoJoin: false }).kind === "ready"
  );
}
