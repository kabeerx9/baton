import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import type { taskChangeRequestTable } from "../database/schema";
import { REQUEST_STATES } from "./lifecycle";

export type ChangeRequestRow = typeof taskChangeRequestTable.$inferSelect;

const channelSchema = z.enum(["web", "agent"]).nullable();

export const changeRequestSchema = z
  .object({
    id: z.string(),
    state: z.string().openapi({
      description: `One of: ${REQUEST_STATES.join(", ")}. Only pending can still change. Treat any other value as final.`,
    }),
    kind: z.string().openapi({ description: "status or delete." }),
    targetStatus: z.string().nullable().openapi({
      description: "The requested status slug; null for a delete request.",
    }),
    baseStatus: z.string().openapi({
      description:
        "The task's status when the request was made. The request applies only if nothing changed since.",
    }),
    expiresAt: responseTimestamp.openapi({
      description:
        "After this time an unanswered request applies, unless it targets a final column, archiving or deletion; those expire. The hourly check runs it within about an hour.",
    }),
    requestedBy: z.string().nullable(),
    channel: channelSchema.openapi({
      description: "web or agent: how the requester acted.",
    }),
    createdAt: responseTimestamp,
    taskId: z.string().nullable().openapi({
      description: "Null once the task is deleted; the request stays readable.",
    }),
    taskKey: z.string(),
    taskTitle: z.string(),
    workspaceId: z.string(),
    decidedBy: z.string().nullable(),
    decidedChannel: channelSchema,
    decidedAt: nullableResponseTimestamp,
    reason: z.string().nullable().openapi({
      description:
        "Why a request was cancelled, superseded or refused, for example task_changed or a blocked message.",
    }),
  })
  .openapi("TaskChangeRequest");

export type ChangeRequestResponse = z.infer<typeof changeRequestSchema>;

export function toChangeRequestResponse(
  row: ChangeRequestRow,
): ChangeRequestResponse {
  return {
    id: row.id,
    state: row.state,
    kind: row.kind,
    targetStatus: row.targetStatus,
    baseStatus: row.baseStatus,
    expiresAt: row.expiresAt,
    requestedBy: row.requestedBy,
    channel: row.channel,
    createdAt: row.createdAt,
    taskId: row.taskId,
    taskKey: row.taskKey,
    taskTitle: row.taskTitle,
    workspaceId: row.workspaceId,
    decidedBy: row.decidedBy,
    decidedChannel: row.decidedChannel,
    decidedAt: row.decidedAt,
    reason: row.reason,
  };
}

/** The compact summary board, task and my-tasks reads carry. */
export const pendingRequestSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    targetStatus: z.string().nullable(),
    requestedBy: z.string().nullable(),
    channel: channelSchema,
    expiresAt: responseTimestamp,
  })
  .nullable()
  .openapi("PendingChangeRequest", {
    description:
      "The open change request on this task, if any. Its creator, assignee or a workspace admin can accept or reject it.",
  });

export type PendingRequestSummary = z.infer<typeof pendingRequestSchema>;

/**
 * The mutation result union for status and delete paths. The HTTP code is
 * 200 for applied and 202 for requested, but clients that drop the code
 * (MCP) read `outcome`.
 */
export function mutationResultSchema<T extends z.ZodType>(
  task: T,
  name: string,
) {
  return {
    applied: z
      .object({ outcome: z.literal("applied"), task })
      .openapi(`${name}Applied`),
    requested: z
      .object({
        outcome: z.literal("requested"),
        request: changeRequestSchema,
        task,
      })
      .openapi(`${name}Requested`, {
        description:
          "You are not involved in this task, so the change was not made: it waits for the task's creator, its assignee or a workspace admin to accept it.",
      }),
  };
}
