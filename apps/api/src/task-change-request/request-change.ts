import { ApiError } from "../errors/api-error";
import type { DbOrTx } from "../project-access/db-or-tx";
import type { PersonActor } from "./actor";
import {
  type Consent,
  NOT_ASSIGNED_MESSAGE,
  OUTSIDER_REASSIGN_MESSAGE,
} from "./consent";
import type { RequestEffect } from "./effects";
import { involvedPeople } from "./load-consent-facts";
import { type LockedTask, openChangeRequest } from "./open-change-request";
import type { ChangeRequestRow } from "./response";
import { columnFinality } from "./status-change";

/** The refusal a person gets when consent says no. */
export function consentError(consent: Extract<Consent, { kind: "deny" }>) {
  if (consent.message === OUTSIDER_REASSIGN_MESSAGE)
    return new ApiError(403, {
      message: consent.message,
      code: "NOT_INVOLVED",
    });
  if (consent.message === NOT_ASSIGNED_MESSAGE)
    return new ApiError(403, {
      message: consent.message,
      code: "NOT_ASSIGNED",
    });
  const missing = consent.message.match(/task:(\w+)/)?.[0];
  return new ApiError(consent.status, {
    message: consent.message,
    code: "MISSING_PERMISSION",
    ...(missing ? { missingPermissions: [missing] } : {}),
  });
}

/** Refusal for paths that cannot create requests (bulk, reorder, move). */
export const NOT_INVOLVED_MESSAGE =
  "You are not involved in this task. Request the change on the task itself, and its creator, assignee or a workspace admin can accept it.";

/**
 * Whether an unanswered request applies after 24 hours: only a status change
 * into a known, non-final column. Final columns, archiving, unarchiving,
 * deletion and any unknown target expire instead.
 */
export async function appliesOnTimeout(
  database: DbOrTx,
  projectId: string,
  kind: string,
  baseStatus: string,
  targetStatus: string | null,
) {
  if (
    kind !== "status" ||
    !targetStatus ||
    targetStatus === "archived" ||
    baseStatus === "archived"
  )
    return false;
  return (await columnFinality(database, projectId, targetStatus)) === false;
}

export async function openRequestWithEffects(
  database: DbOrTx,
  input: {
    task: LockedTask & { createdBy: string | null; userId: string | null };
    workspaceId: string;
    actor: PersonActor;
    kind: "status" | "delete";
    targetStatus: string | null;
  },
): Promise<{ request: ChangeRequestRow; effects: RequestEffect[] }> {
  const opened = await openChangeRequest(database, input);
  if (opened.replay) return { request: opened.request, effects: [] };
  return {
    request: opened.request,
    effects: [
      {
        type: "opened",
        request: opened.request,
        superseded: opened.superseded,
        answerers: await involvedPeople(database, input.task),
        appliesOnTimeout: await appliesOnTimeout(
          database,
          input.task.projectId,
          input.kind,
          input.task.status,
          input.targetStatus,
        ),
      },
    ],
  };
}
