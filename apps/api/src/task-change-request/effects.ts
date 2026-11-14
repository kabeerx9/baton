import { eq } from "drizzle-orm";
import db from "../database";
import { projectTable, taskTable, userTable } from "../database/schema";
import { publishEvent } from "../events";
import createNotification from "../notification/controllers/create-notification";
import { slackConfig } from "../slack-dm/config";
import { sendDm } from "../slack-dm/send-dm";
import {
  outcomeBody,
  outcomeTitle,
  requestedBody,
  requestedTitle,
  slackEscape,
} from "./messages";
import type { ChangeRequestRow } from "./response";

/**
 * What a committed transaction owes people, dispatched only after commit.
 * Notifications are filtered by current access in `persistNotification`;
 * Slack is best effort and never fails the change.
 */
export type RequestEffect =
  | {
      type: "opened";
      request: ChangeRequestRow;
      superseded: ChangeRequestRow | null;
      /** Involved people before the change; they are asked to answer. */
      answerers: string[];
      appliesOnTimeout: boolean;
    }
  /** A request reached a final state; its requester hears about it. */
  | { type: "finished"; request: ChangeRequestRow; actorId: string | null }
  | {
      type: "outsider_edit";
      taskId: string;
      projectId: string;
      taskTitle: string;
      actorId: string;
      involved: string[];
      fields: string[];
    };

async function userName(userId: string | null) {
  if (!userId) return null;
  const [row] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return row?.name ?? null;
}

async function taskUrl(taskId: string | null) {
  const config = slackConfig();
  if (!config || !taskId) return null;
  const [row] = await db
    .select({
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(taskTable.id, taskId))
    .limit(1);
  return row
    ? `${config.clientUrl}/dashboard/workspace/${row.workspaceId}/project/${row.projectId}/task/${taskId}`
    : null;
}

function resource(request: ChangeRequestRow) {
  return request.taskId
    ? { resourceId: request.taskId, resourceType: "task" }
    : { resourceId: request.workspaceId, resourceType: "workspace" };
}

async function notifyPerson(
  userId: string,
  request: ChangeRequestRow,
  type: string,
  title: string,
  content: string,
) {
  const notification = await createNotification({
    userId,
    type,
    title,
    content,
    eventData: {
      requestId: request.id,
      taskKey: request.taskKey,
      taskTitle: request.taskTitle,
      kind: request.kind,
      targetStatus: request.targetStatus,
      state: request.state,
    },
    ...resource(request),
  });
  if (!notification || !slackConfig()) return;
  const url = await taskUrl(request.taskId);
  const link = url
    ? `\n<${url}|Open ${slackEscape(request.taskKey)} in Baton>`
    : "";
  await sendDm(
    userId,
    `*${slackEscape(title)}*\n${slackEscape(content)}${link}`,
  );
}

async function publishRequestUpdated(request: ChangeRequestRow) {
  if (!request.projectId) return;
  await publishEvent("task_change_request.updated", {
    taskId: request.taskId ?? "",
    projectId: request.projectId,
    requestId: request.id,
    state: request.state,
  });
}

async function dispatch(effect: RequestEffect) {
  switch (effect.type) {
    case "opened": {
      const { request, superseded } = effect;
      const who = await userName(request.requestedBy);
      for (const userId of effect.answerers) {
        if (userId === request.requestedBy) continue;
        await notifyPerson(
          userId,
          request,
          "task_change_requested",
          requestedTitle(request, who),
          requestedBody(request, effect.appliesOnTimeout),
        );
      }
      if (
        superseded?.requestedBy &&
        superseded.requestedBy !== request.requestedBy
      )
        await notifyPerson(
          superseded.requestedBy,
          superseded,
          "task_change_request_finished",
          outcomeTitle(superseded),
          outcomeBody(superseded),
        );
      await publishRequestUpdated(request);
      return;
    }
    case "finished": {
      const { request } = effect;
      if (request.requestedBy && request.requestedBy !== effect.actorId)
        await notifyPerson(
          request.requestedBy,
          request,
          "task_change_request_finished",
          outcomeTitle(request),
          outcomeBody(request),
        );
      await publishRequestUpdated(request);
      return;
    }
    case "outsider_edit": {
      const who = (await userName(effect.actorId)) ?? "Someone";
      for (const userId of effect.involved) {
        if (userId === effect.actorId) continue;
        await createNotification({
          userId,
          type: "task_outsider_edit",
          title: `${who} edited "${effect.taskTitle}"`,
          content: `Changed: ${effect.fields.join(", ")}.`,
          eventData: { taskTitle: effect.taskTitle, fields: effect.fields },
          resourceId: effect.taskId,
          resourceType: "task",
        });
      }
      return;
    }
  }
}

export async function dispatchRequestEffects(effects: RequestEffect[]) {
  for (const effect of effects) {
    try {
      await dispatch(effect);
    } catch (error) {
      // The change is committed; a failed message must not undo or fail it.
      console.error("[change-request] failed to dispatch an effect", error);
    }
  }
}

export function finishedEffects(
  requests: ChangeRequestRow[],
  actorId: string | null,
): RequestEffect[] {
  return requests.map((request) => ({ type: "finished", request, actorId }));
}
