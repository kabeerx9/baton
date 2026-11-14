import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { taskChangeRequestTable } from "../database/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  pagingNumber,
  z,
} from "../openapi";
import { taskSchema } from "../task/response";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { actorFromContext } from "./actor";
import { decideChangeRequest, type Decision } from "./decide-change-request";
import { canReadRequest, listChangeRequests } from "./list-change-requests";
import { changeRequestSchema, toChangeRequestResponse } from "./response";

const idParam = z.object({ id: z.string().min(1) });

const listQuery = z.object({
  workspaceId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  requestedBy: z.literal("me").optional().openapi({
    description: "Only the caller's own requests.",
  }),
  canAnswer: z.literal("me").optional().openapi({
    description:
      "Only pending requests the caller can accept or reject: on tasks they created or are assigned, or any task for a workspace owner or admin.",
  }),
  state: z.string().min(1).optional(),
  limit: pagingNumber(1, 100, 50),
  offset: pagingNumber(0, 100_000, 0),
});

const decisionSchema = z
  .object({ request: changeRequestSchema, task: taskSchema.nullable() })
  .openapi("TaskChangeRequestDecision");

// Resolves the request's workspace before the validators run (route
// middleware reads the raw request), then applies the usual access checks.
async function requestWorkspaceAccess(c: Context, next: Next) {
  const id = c.req.param("id") ?? "";
  const [row] = await db
    .select({ workspaceId: taskChangeRequestTable.workspaceId })
    .from(taskChangeRequestTable)
    .where(eq(taskChangeRequestTable.id, id))
    .limit(1);
  if (!row) throw new HTTPException(404, { message: "Request not found" });
  await validateWorkspaceAccess(
    c.get("userId"),
    row.workspaceId,
    c.get("apiKey")?.id,
    {
      notFoundMessage: "Request not found",
    },
  );
  c.set("workspaceId", row.workspaceId);
  return next();
}

async function readableRequest(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(taskChangeRequestTable)
    .where(and(eq(taskChangeRequestTable.id, id), canReadRequest(userId)))
    .limit(1);
  if (!row) throw new HTTPException(404, { message: "Request not found" });
  return row;
}

const listRoute = createRoute({
  method: "get",
  operationId: "listTaskChangeRequests",
  path: "/",
  tags: ["Change requests"],
  summary: "List change requests",
  description:
    "Change requests in a workspace, newest first. Filter by task, by the caller's own requests (requestedBy=me), by those the caller can answer (canAnswer=me), or by state. Requests on repos the caller cannot see are left out, except their own.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { query: listQuery },
  responses: {
    200: jsonResponse(
      "One page of requests",
      z
        .object({ requests: z.array(changeRequestSchema), total: z.number() })
        .openapi("TaskChangeRequestList"),
    ),
    403: errorResponse("Missing task:read permission"),
    404: errorResponse("Workspace not found"),
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getTaskChangeRequest",
  path: "/{id}",
  tags: ["Change requests"],
  summary: "Get a change request",
  description:
    "One request with its current state. Works after the task is deleted, so a caller can always learn how its request ended.",
  middleware: [
    requestWorkspaceAccess,
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: idParam },
  responses: {
    200: jsonResponse("The request", changeRequestSchema),
    403: errorResponse("Missing task:read permission"),
    404: errorResponse("Request not found"),
  },
});

function decisionRoute(
  decision: Decision,
  summary: string,
  description: string,
) {
  return createRoute({
    method: "post",
    operationId: `${decision}TaskChangeRequest`,
    path: `/{id}/${decision}`,
    tags: ["Change requests"],
    summary,
    description,
    middleware: [
      requestWorkspaceAccess,
      requireWorkspacePermission({ task: ["read"] }),
    ] as const,
    request: { params: idParam },
    responses: {
      200: jsonResponse(
        "The request after the decision, and the task",
        decisionSchema,
      ),
      403: errorResponse("Not allowed to make this decision"),
      404: errorResponse("Request not found"),
      409: errorResponse("A different decision is already recorded"),
    },
  });
}

const acceptRoute = decisionRoute(
  "accept",
  "Accept a change request",
  "Apply the requested change. Only the task's creator, its assignee or a workspace owner or admin may accept, with task:update (status) or task:delete (delete), and never the requester. If the task changed since the request, the requester lost access, or the change is refused (for example a blocked task), the request ends cancelled with the reason and nothing changes. Accepting again returns the recorded outcome.",
);
const rejectRoute = decisionRoute(
  "reject",
  "Reject a change request",
  "Refuse the requested change. The same people who may accept may reject. Rejecting again returns the recorded outcome.",
);
const cancelRoute = decisionRoute(
  "cancel",
  "Withdraw a change request",
  "The requester withdraws their own pending request.",
);

async function decide(c: Context, decision: Decision, id: string) {
  const { request, task } = await decideChangeRequest({
    requestId: id,
    actor: actorFromContext(c),
    decision,
  });
  return { request: toChangeRequestResponse(request), task };
}

const taskChangeRequest = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listRoute, async (c) => {
    const query = c.req.valid("query");
    const { rows, total } = await listChangeRequests(
      c.get("userId"),
      c.get("apiKey")?.permissions ?? null,
      query,
    );
    return c.json({ requests: rows.map(toChangeRequestResponse), total }, 200);
  })
  .openapi(getRoute, async (c) =>
    c.json(
      toChangeRequestResponse(
        await readableRequest(c.req.valid("param").id, c.get("userId")),
      ),
      200,
    ),
  )
  .openapi(acceptRoute, async (c) => {
    const { id } = c.req.valid("param");
    await readableRequest(id, c.get("userId"));
    return c.json(await decide(c, "accept", id), 200);
  })
  .openapi(rejectRoute, async (c) => {
    const { id } = c.req.valid("param");
    await readableRequest(id, c.get("userId"));
    return c.json(await decide(c, "reject", id), 200);
  })
  .openapi(cancelRoute, async (c) => {
    const { id } = c.req.valid("param");
    await readableRequest(id, c.get("userId"));
    return c.json(await decide(c, "cancel", id), 200);
  });

export default taskChangeRequest;
