import db from "../database";
import { decideConsent } from "./consent";
import { dispatchRequestEffects } from "./effects";
import {
  type ConsentTask,
  involvedPeople,
  loadConsentFacts,
} from "./load-consent-facts";

/**
 * After a committed field edit (title, description, priority, dates), tell
 * the task's involved people when someone outside it made the edit. Best
 * effort: it runs after commit and never fails the edit.
 */
export async function notifyOutsiderEdit(
  before: ConsentTask,
  title: string,
  actorId: string,
  fields: string[],
) {
  if (!actorId || fields.length === 0) return;
  try {
    const facts = await loadConsentFacts(db, before, {
      userId: actorId,
      scope: null,
    });
    const consent = decideConsent("edit", facts);
    if (consent.kind !== "apply" || !consent.notifyInvolved) return;
    await dispatchRequestEffects([
      {
        type: "outsider_edit",
        taskId: before.id,
        projectId: before.projectId,
        taskTitle: title,
        actorId,
        involved: await involvedPeople(db, before),
        fields,
      },
    ]);
  } catch (error) {
    console.error("[change-request] outsider edit notice failed", error);
  }
}
