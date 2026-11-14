/**
 * Who may change a task directly, and who may only ask. Pure: the facts are
 * loaded under the task lock by `load-consent-facts.ts`.
 *
 * Existing permissions come first. Involvement (creator or assignee, with
 * access to the task's repo) and the bypass roles (workspace owner or admin)
 * only decide between applying and requesting; they never grant a permission
 * the role or API key lacks.
 */
export type TaskChangeKind =
  /** A status change, including archiving. */
  | "status"
  | "delete"
  /** Changing, clearing or taking the assignee. */
  | "assign"
  /** Title, description, priority, dates. */
  | "edit";

export type ConsentFacts = {
  involved: boolean;
  bypass: boolean;
  /** The task has subtasks; its own status is not used. */
  feature: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export type Consent =
  | { kind: "apply"; notifyInvolved: boolean }
  | { kind: "request" }
  | { kind: "deny"; status: 403; message: string };

export const OUTSIDER_REASSIGN_MESSAGE =
  "Only the task's creator, its assignee or a workspace admin can change who it is assigned to.";

export function decideConsent(
  change: TaskChangeKind,
  facts: ConsentFacts,
): Consent {
  const consents = facts.involved || facts.bypass;
  switch (change) {
    case "edit":
      return { kind: "apply", notifyInvolved: !consents };
    case "assign":
      return consents
        ? { kind: "apply", notifyInvolved: false }
        : { kind: "deny", status: 403, message: OUTSIDER_REASSIGN_MESSAGE };
    case "status":
      if (!facts.canUpdate)
        return {
          kind: "deny",
          status: 403,
          message: "Missing task:update permission",
        };
      // A feature's column comes from its tasks; its own status is unused.
      if (consents || facts.feature)
        return { kind: "apply", notifyInvolved: false };
      return { kind: "request" };
    case "delete":
      if (consents)
        return facts.canDelete
          ? { kind: "apply", notifyInvolved: false }
          : {
              kind: "deny",
              status: 403,
              message: "Missing task:delete permission",
            };
      return facts.canUpdate || facts.canDelete
        ? { kind: "request" }
        : {
            kind: "deny",
            status: 403,
            message: "Missing task:update permission",
          };
  }
}

export type AnswerFacts = {
  isRequester: boolean;
  involved: boolean;
  bypass: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

/** Who may accept or reject a pending request. */
export function decideAnswer(
  kind: "status" | "delete",
  facts: AnswerFacts,
): { ok: true } | { ok: false; message: string } {
  if (facts.isRequester)
    return { ok: false, message: "You cannot answer your own request." };
  const permitted = kind === "delete" ? facts.canDelete : facts.canUpdate;
  if (!permitted)
    return {
      ok: false,
      message:
        kind === "delete"
          ? "Missing task:delete permission"
          : "Missing task:update permission",
    };
  if (!facts.involved && !facts.bypass)
    return {
      ok: false,
      message:
        "Only the task's creator, its assignee or a workspace admin can answer this request.",
    };
  return { ok: true };
}
