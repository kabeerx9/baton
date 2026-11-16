import { HTTPException } from "hono/http-exception";
import { isReservedActivityType } from "./reserved-activity-types";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createActivity from "./controllers/create-activity";
import createComment from "./controllers/create-comment";
import deleteComment from "./controllers/delete-comment";
import getActivities from "./controllers/get-activities";
import getWorkspaceActivities from "./controllers/get-workspace-activities";
import updateComment from "./controllers/update-comment";
import {
  activityListSchema,
  activitySchema,
  workspaceActivityListSchema,
} from "./response";
import {
  activitiesQuery,
  createActivityBody,
  createCommentBody,
  deleteCommentBody,
  taskIdParam,
  updateCommentBody,
  workspaceIdParam,
} from "./schema";

const getWorkspaceActivitiesRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceActivities",
  path: "/workspace/{workspaceId}",
  tags: ["Activity"],
  summary: "Get recent workspace activity",
  description:
    "Get the 20 most recent task events across a workspace's active projects from the last 30 days, newest first. Each event carries a short plain-text excerpt instead of its full content.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse(
      "Recent activity in the workspace",
      workspaceActivityListSchema,
    ),
    403: errorResponse("Missing project:read or task:read permission"),
    404: errorResponse("Workspace not found"),
  },
});

const getActivitiesRoute = createRoute({
  method: "get",
  operationId: "getActivities",
  path: "/{taskId}",
  tags: ["Activity"],
  summary: "Get task activity",
  description:
    "Get a task's activity feed, newest first: comments alongside system events such as status and assignee changes. Set limit to request a bounded preview; omit it for the full feed.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskIdParam, query: activitiesQuery },
  responses: {
    200: jsonResponse("List of activities for the task", activityListSchema),
    403: errorResponse("No access to the project, or missing read permission"),
    404: errorResponse("Task not found"),
  },
});

const createActivityRoute = createRoute({
  method: "post",
  operationId: "createActivity",
  path: "/create",
  tags: ["Activity"],
  summary: "Create activity",
  description:
    "Record a system-generated event on a task. Most events are written by the server itself; this exists for integrations.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createActivityBody } },
    },
  },
  responses: {
    200: jsonResponse("The created activity", activitySchema),
    400: errorResponse(
      "Invalid body, or a comment or other server-written activity type submitted through the generic endpoint",
    ),
    403: errorResponse(
      "No access to the project, or missing task:update permission",
    ),
    404: errorResponse("Task not found"),
  },
});

const createCommentRoute = createRoute({
  method: "post",
  operationId: "createComment",
  path: "/comment",
  tags: ["Activity"],
  summary: "Create comment",
  description:
    "Add a comment to a task. Equivalent to POST /comment/{taskId}, kept for the activity-feed client.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createCommentBody } },
    },
  },
  responses: {
    200: jsonResponse("The created comment", activitySchema),
    400: errorResponse("Invalid body"),
    403: errorResponse(
      "No access to the project, or missing task:update permission",
    ),
    404: errorResponse("Task not found"),
  },
});

const updateCommentRoute = createRoute({
  method: "put",
  operationId: "updateComment",
  path: "/comment",
  tags: ["Activity"],
  summary: "Update comment",
  description: "Edit a comment. Only the comment's author may do this.",
  middleware: [
    workspaceAccess.fromActivity("activityId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: updateCommentBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated comment", activitySchema),
    400: errorResponse("Invalid body"),
    403: errorResponse(
      "Not the author, no access to the project, or missing task:update permission",
    ),
    404: errorResponse("Activity or comment not found"),
  },
});

const deleteCommentRoute = createRoute({
  method: "delete",
  operationId: "deleteComment",
  path: "/comment",
  tags: ["Activity"],
  summary: "Delete comment",
  description: "Delete a comment. Only the comment's author may do this.",
  middleware: [
    workspaceAccess.fromActivity("activityId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: deleteCommentBody } },
    },
  },
  responses: {
    200: jsonResponse("The deleted comment", activitySchema),
    400: errorResponse("Invalid body"),
    403: errorResponse(
      "Not the author, no access to the project, or missing task:update permission",
    ),
    404: errorResponse("Activity or comment not found"),
  },
});

const activity = apiRouter()
  .openapi(getWorkspaceActivitiesRoute, async (c) =>
    c.json(
      await getWorkspaceActivities(
        c.req.valid("param").workspaceId,
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(getActivitiesRoute, async (c) =>
    c.json(
      await getActivities(
        c.req.valid("param").taskId,
        c.get("userId"),
        c.req.valid("query").limit,
      ),
      200,
    ),
  )
  .openapi(createActivityRoute, async (c) => {
    const { taskId, message, type, eventData } = c.req.valid("json");
    if (type === "comment") {
      throw new HTTPException(400, {
        message: "Use the comment endpoint to create comments",
      });
    }
    if (isReservedActivityType(type)) {
      throw new HTTPException(400, {
        message: `Activity type "${type}" is written by the server only`,
      });
    }
    return c.json(
      await createActivity(taskId, type, c.get("userId"), message, eventData),
      200,
    );
  })
  .openapi(createCommentRoute, async (c) => {
    const { taskId, comment } = c.req.valid("json");
    return c.json(await createComment(taskId, c.get("userId"), comment), 200);
  })
  .openapi(updateCommentRoute, async (c) => {
    const { activityId, comment } = c.req.valid("json");
    return c.json(
      await updateComment(c.get("userId"), activityId, comment),
      200,
    );
  })
  .openapi(deleteCommentRoute, async (c) =>
    c.json(
      await deleteComment(c.get("userId"), c.req.valid("json").activityId),
      200,
    ),
  );

// Activity rows for task events come from the outbox: see
// activity/outbox-consumer.ts and events/outbox/routes.ts.

export default activity;
