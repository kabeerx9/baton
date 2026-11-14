import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { actorFromContext } from "../task-change-request/actor";
import {
  changeRequestSchema,
  toChangeRequestResponse,
} from "../task-change-request/response";
import addSubtask from "./controllers/add-subtask";
import createBoardTask from "./controllers/create-board-task";
import {
  addSubtaskPlans,
  createTaskPlan,
  updateByKey,
} from "./controllers/plan-task";
import getTeamHistory from "./controllers/get-team-history";
import getBoard from "./controllers/get-board";
import { boardSchema, teamHistorySchema } from "./response";
import {
  addSubtaskBody,
  createBoardTaskBody,
  boardTaskIdParam,
  addSubtaskPlansBody,
  boardKeyParam,
  boardWorkspaceParam,
  taskPlanBody,
  updateByKeyBody,
  teamHistoryQuery,
} from "./schema";

const getBoardRoute = createRoute({
  method: "get",
  operationId: "getBoard",
  path: "/workspace/{workspaceId}",
  tags: ["Board"],
  summary: "Get the workspace board",
  description:
    "Every task of the workspace, each with its board column, its subtasks from any repo project the caller can see, the blocks links between them, and their pull requests. Also lists the workspace's visible projects with their connected repository.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: boardWorkspaceParam },
  responses: {
    200: jsonResponse("The board", boardSchema),
    403: errorResponse("Not a member, or missing task:read permission"),
  },
});

const getTeamHistoryRoute = createRoute({
  method: "get",
  operationId: "getTeamHistory",
  path: "/workspace/{workspaceId}/history",
  tags: ["Board"],
  summary: "Get the team history",
  description:
    "Per person: how much work they finished in the last N days, split by repo, with their most recent finished items and their current open count. A unit of work is a subtask, or a board task with no subtasks.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: boardWorkspaceParam, query: teamHistoryQuery },
  responses: {
    200: jsonResponse("The team history", teamHistorySchema),
    403: errorResponse("Not a member, or missing task:read permission"),
  },
});

const plannedSubtaskSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  repo: z.string().nullable(),
  owner: z.string().nullable(),
  waitsOn: z.array(z.string()),
});

const planTaskRoute = createRoute({
  method: "post",
  operationId: "planBoardTask",
  path: "/workspace/{workspaceId}/plan",
  tags: ["Board"],
  summary: "Create a task with its subtasks and links in one request",
  description:
    "Creates a task, its subtasks, their owners and their waits-on links. People and repos are given by name. Every name is checked before anything is created.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: {
    params: boardWorkspaceParam,
    body: {
      required: true,
      content: { "application/json": { schema: taskPlanBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "What was created",
      z
        .object({
          id: z.string(),
          key: z.string(),
          title: z.string(),
          owner: z.string().nullable(),
          subtasks: z.array(plannedSubtaskSchema),
        })
        .openapi("BoardTaskPlanResult"),
    ),
    400: errorResponse("A person, repo or waits-on entry could not be found"),
    403: errorResponse("Not a member, or missing task:create permission"),
  },
});

const addSubtaskPlansRoute = createRoute({
  method: "post",
  operationId: "addBoardSubtasksByKey",
  path: "/workspace/{workspaceId}/item/{key}/subtasks",
  tags: ["Board"],
  summary: "Add subtasks to a task found by its key",
  description:
    "Adds subtasks to an existing board task. People and repos are given by name.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: {
    params: boardKeyParam,
    body: {
      required: true,
      content: { "application/json": { schema: addSubtaskPlansBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "What was created",
      z
        .object({
          key: z.string(),
          title: z.string(),
          subtasks: z.array(plannedSubtaskSchema),
        })
        .openapi("BoardSubtasksAdded"),
    ),
    400: errorResponse("A person, repo or waits-on entry could not be found"),
    404: errorResponse("No task with that key"),
  },
});

const boardItemFields = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  status: z.string(),
  owner: z.string().nullable().optional(),
  nowWaitsOn: z.array(z.string()),
});

const updateByKeyRoute = createRoute({
  method: "patch",
  operationId: "updateBoardItemByKey",
  path: "/workspace/{workspaceId}/item/{key}",
  tags: ["Board"],
  summary: "Change a task or subtask found by its key",
  description:
    'Sets the status, the owner, or what the item waits on. A blocked item cannot be set to done. Only the task\'s creator, its owner or a workspace owner or admin may change the owner (403 otherwise). If you are not involved in the task, a status change is not made: the response is 202 with outcome "requested" and the change request. Read `outcome`, not only the HTTP status.',
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: boardKeyParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateByKeyBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The item after the change",
      boardItemFields
        .extend({ outcome: z.literal("applied") })
        .openapi("BoardItemUpdated"),
    ),
    202: jsonResponse(
      "Other changes applied; the status change waits as a request",
      boardItemFields
        .extend({
          outcome: z.literal("requested"),
          request: changeRequestSchema,
        })
        .openapi("BoardItemChangeRequested"),
    ),
    400: errorResponse("A person or status could not be found"),
    403: errorResponse("An owner change by someone not involved in the task"),
    404: errorResponse("No task with that key"),
    409: errorResponse("The item is blocked and cannot be finished"),
    429: errorResponse("Too many change requests in the last hour"),
  },
});

const boardTaskCreatedSchema = z
  .object({
    id: z.string(),
    number: z.number().nullable(),
    title: z.string(),
    projectId: z.string(),
    status: z.string(),
  })
  .openapi("BoardCreated");

const createBoardTaskRoute = createRoute({
  method: "post",
  operationId: "createBoardTask",
  path: "/workspace/{workspaceId}",
  tags: ["Board"],
  summary: "Create a task",
  description:
    "Create a task on the workspace board. Give it an assignee to use it as a plain task, or add repo subtasks to it afterwards.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: {
    params: boardWorkspaceParam,
    body: {
      required: true,
      content: { "application/json": { schema: createBoardTaskBody } },
    },
  },
  responses: {
    200: jsonResponse("The created task", boardTaskCreatedSchema),
    400: errorResponse("Invalid body"),
    403: errorResponse("Not a member, or missing task:create permission"),
  },
});

const addSubtaskRoute = createRoute({
  method: "post",
  operationId: "addSubtask",
  path: "/{taskId}/subtask",
  tags: ["Board"],
  summary: "Add a subtask to a task",
  description:
    "Create a subtask and link it under a board task in one transaction. The subtask lives in a repo project, or in the board project itself for work that has no repo (QA, design, ops).",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: {
    params: boardTaskIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: addSubtaskBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The created subtask",
      z
        .object({
          id: z.string(),
          number: z.number().nullable(),
          title: z.string(),
          projectId: z.string(),
          status: z.string(),
        })
        .openapi("BoardSubtaskCreated"),
    ),
    400: errorResponse("Invalid body or status"),
    403: errorResponse(
      "No access to a project, or missing task:create permission",
    ),
    404: errorResponse("BoardTask or project not found"),
  },
});

const board = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getBoardRoute, async (c) =>
    c.json(await getBoard(c.get("workspaceId"), c.get("userId")), 200),
  )
  .openapi(getTeamHistoryRoute, async (c) =>
    c.json(
      await getTeamHistory(
        c.get("workspaceId"),
        c.get("userId"),
        c.req.valid("query").days ?? 30,
      ),
      200,
    ),
  )
  .openapi(planTaskRoute, async (c) =>
    c.json(
      await createTaskPlan({
        ...c.req.valid("json"),
        workspaceId: c.get("workspaceId"),
        currentUserId: c.get("userId"),
      }),
      200,
    ),
  )
  .openapi(addSubtaskPlansRoute, async (c) =>
    c.json(
      await addSubtaskPlans({
        ...c.req.valid("json"),
        taskKey: c.req.valid("param").key,
        workspaceId: c.get("workspaceId"),
        currentUserId: c.get("userId"),
      }),
      200,
    ),
  )
  .openapi(updateByKeyRoute, async (c) => {
    const result = await updateByKey({
      ...c.req.valid("json"),
      key: c.req.valid("param").key,
      workspaceId: c.get("workspaceId"),
      currentUserId: c.get("userId"),
      actor: actorFromContext(c),
    });
    return result.outcome === "requested"
      ? c.json(
          { ...result, request: toChangeRequestResponse(result.request) },
          202,
        )
      : c.json(result, 200);
  })
  .openapi(createBoardTaskRoute, async (c) => {
    const task = await createBoardTask({
      ...c.req.valid("json"),
      workspaceId: c.get("workspaceId"),
      currentUserId: c.get("userId"),
    });
    return c.json(
      {
        id: task.id,
        number: task.number,
        title: task.title,
        projectId: task.projectId,
        status: task.status,
      },
      200,
    );
  })
  .openapi(addSubtaskRoute, async (c) => {
    const body = c.req.valid("json");
    const task = await addSubtask({
      ...body,
      taskId: c.req.valid("param").taskId,
      workspaceId: c.get("workspaceId"),
      currentUserId: c.get("userId"),
    });
    return c.json(
      {
        id: task.id,
        number: task.number,
        title: task.title,
        projectId: task.projectId,
        status: task.status,
      },
      200,
    );
  });

export default board;
