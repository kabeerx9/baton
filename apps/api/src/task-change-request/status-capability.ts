import type { DbOrTx } from "../project-access/db-or-tx";
import { type ConsentFacts, decideConsent } from "./consent";
import {
  type ConsentTask,
  loadConsentFacts,
  type PersonGrants,
} from "./load-consent-facts";

/** What an ordinary column move by the viewer would do right now. */
export type StatusMove = "apply" | "request" | "deny";

/**
 * Any status other than `archived`. Only the archive toggle changes the
 * outcome of a status consent, so one ordinary target stands for every column.
 */
const ORDINARY_TARGET = "to-do";

/**
 * The consent rule for an ordinary column move (never archive). Leaving
 * `archived` toggles archive, so an archived item is judged as that toggle.
 */
export function ordinaryStatusMove(
  facts: ConsentFacts,
  currentStatus: string,
): StatusMove {
  return decideConsent("status", facts, {
    from: currentStatus,
    to: ORDINARY_TARGET,
  }).kind;
}

type ReadTask = {
  status: string;
  createdBy: string | null;
  assigneeId: string | null;
  /** The task has any subtask link, visible to the viewer or not. */
  feature: boolean;
};

/**
 * The move for many tasks the viewer can already see, with grants loaded
 * once. A task in a read the viewer can see passes the repo-access part of
 * involvement, so only creator and assignee are compared here.
 */
export function visibleStatusMove(
  grants: Pick<PersonGrants, "member" | "bypass" | "can">,
  userId: string,
  task: ReadTask,
): StatusMove {
  return ordinaryStatusMove(
    {
      involved:
        grants.member &&
        (task.createdBy === userId || task.assigneeId === userId),
      bypass: grants.bypass,
      feature: task.feature,
      canUpdate: grants.can({ task: ["update"] }),
      canDelete: grants.can({ task: ["delete"] }),
      canAssign: grants.can({ task: ["assign"] }),
    },
    task.status,
  );
}

/** The move for one task read on its own, from the same facts the write uses. */
export async function loadStatusMove(
  database: DbOrTx,
  task: ConsentTask & { status: string },
  person: Parameters<typeof loadConsentFacts>[2],
): Promise<StatusMove> {
  return ordinaryStatusMove(
    await loadConsentFacts(database, task, person),
    task.status,
  );
}
