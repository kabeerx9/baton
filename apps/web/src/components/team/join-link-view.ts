import type { JoinLink } from "@/fetchers/join-link/types";

/** What the share-link card shows. Derived from the server row and the clock. */
export type JoinLinkView =
  | { kind: "none" }
  | { kind: "active"; url: string }
  | { kind: "active_no_url" }
  | { kind: "expired" }
  | { kind: "used_up" };

/**
 * Pure. Only an `active` row that has not passed its expiry on this clock is
 * shown as active. An unknown state is shown as expired, never as active.
 */
export function deriveJoinLinkView(
  link: JoinLink | null | undefined,
  now: number,
): JoinLinkView {
  if (!link) return { kind: "none" };
  if (link.state === "used_up") return { kind: "used_up" };
  if (link.state !== "active") return { kind: "expired" };
  if (new Date(link.expiresAt).getTime() <= now) return { kind: "expired" };
  if (
    link.maxUses !== null &&
    link.maxUses > 0 &&
    link.useCount >= link.maxUses
  ) {
    return { kind: "used_up" };
  }
  return link.url
    ? { kind: "active", url: link.url }
    : { kind: "active_no_url" };
}

/** Creating over an active link kills it, so that case asks first. */
export function needsReplaceConfirm(view: JoinLinkView): boolean {
  return view.kind === "active" || view.kind === "active_no_url";
}

export const MAX_USES_LIMIT = 10_000;

/** Empty means no limit. Anything but a whole number 1..10000 is invalid. */
export function parseMaxUses(
  text: string,
): { ok: true; value: number | null } | { ok: false } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  return value >= 1 && value <= MAX_USES_LIMIT
    ? { ok: true, value }
    : { ok: false };
}
