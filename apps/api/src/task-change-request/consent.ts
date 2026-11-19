/**
 * Who may change a task directly, and who may only ask. Pure: the facts are
 * loaded under the task lock by `load-consent-facts.ts`.
 *
 * Existing permissions come first. Involvement (creator or assignee, with
 * access to the task's repo) and the bypass roles (workspace owner or admin)
 * only decide between applying and requesting; they never grant a permission
 * the role or API key lacks.
 *
 * `task:update_assigned` without `task:update` (the viewer) works only on a
 * task assigned to the caller: there it applies status and edits directly;
 * anywhere else it is refused, never turned into a request.
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
  /**
   * The caller is the task's assignee, a member, and can see its repo. Not
   * the same as involved: a creator who is not the assignee is involved.
   */
  assignee: boolean;
  bypass: boolean;
  /** The task has subtasks; its own status is not used. */
  feature: boolean;
  canUpdate: boolean;
  /** task:update_assigned; true whenever canUpdate is. */
  canUpdateAssigned: boolean;
  canDelete: boolean;
  canAssign: boolean;
};

export const NOT_ASSIGNED_MESSAGE =
  "You can only change tasks assigned to you.";

type WorkFacts = Pick<
  ConsentFacts,
  "assignee" | "canUpdate" | "canUpdateAssigned"
>;

/** Full task:update, or task:update_assigned on the caller's own task. */
export function mayWorkOn(facts: WorkFacts) {
  return facts.canUpdate || (facts.canUpdateAssigned && facts.assignee);
}

function workDenied(facts: WorkFacts): Extract<Consent, { kind: "deny" }> {
  return {
    kind: "deny",
    status: 403,
    message: facts.canUpdateAssigned
      ? NOT_ASSIGNED_MESSAGE
      : "Missing task:update permission",
  };
}

/** The status move a "status" change makes. */
export type StatusMove = { from: string; to: string };

/**
 * Archiving hides a task and stops it blocking anything, even for a
 * feature, whose other statuses are unused. So archive and unarchive never
 * take the feature exception.
 */
export function togglesArchive(move: StatusMove) {
  return (move.from === "archived") !== (move.to === "archived");
}

export type Consent =
  | { kind: "apply"; notifyInvolved: boolean }
  | { kind: "request" }
  | { kind: "deny"; status: 403; message: string };

export const OUTSIDER_REASSIGN_MESSAGE =
  "Only the task's creator, its assignee or a workspace admin can change who it is assigned to.";

/**
 * `move` is required for the feature exception: without it a status change
 * is judged as for a plain task (the safe default).
 */
export function decideConsent(
  change: TaskChangeKind,
  facts: ConsentFacts,
  move?: StatusMove,
): Consent {
  const consents = facts.involved || facts.bypass;
  switch (change) {
    case "edit":
      if (!mayWorkOn(facts)) return workDenied(facts);
      return { kind: "apply", notifyInvolved: !consents };
    case "assign":
      if (!facts.canAssign)
        return {
          kind: "deny",
          status: 403,
          message: "Missing task:assign permission",
        };
      return consents
        ? { kind: "apply", notifyInvolved: false }
        : { kind: "deny", status: 403, message: OUTSIDER_REASSIGN_MESSAGE };
    case "status":
      // Only full task:update reaches the request and feature rules below.
      if (!facts.canUpdate)
        return mayWorkOn(facts)
          ? { kind: "apply", notifyInvolved: false }
          : workDenied(facts);
      // A feature's column comes from its tasks; its own status is unused,
      // except archived.
      if (consents || (facts.feature && move && !togglesArchive(move)))
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
      // Asking needs task:update, the same permission accept and the
      // timeout job re-check for the requester.
      return facts.canUpdate
        ? { kind: "request" }
        : {
            kind: "deny",
            status: 403,
            message: "Missing task:update permission",
          };
  }
}

export type AnswerFacts = WorkFacts & {
  isRequester: boolean;
  involved: boolean;
  bypass: boolean;
  canDelete: boolean;
};

/**
 * Who may accept or reject a pending request. A status request needs what a
 * direct status change needs: task:update, or task:update_assigned as the
 * task's current assignee.
 */
export function decideAnswer(
  kind: "status" | "delete",
  facts: AnswerFacts,
): { ok: true } | { ok: false; message: string } {
  if (facts.isRequester)
    return { ok: false, message: "You cannot answer your own request." };
  const permitted = kind === "delete" ? facts.canDelete : mayWorkOn(facts);
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
