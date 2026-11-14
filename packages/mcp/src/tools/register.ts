import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { buildFullTaskUpdateBody } from "../baton/task-helpers.js";
import { errorResult, textResult } from "../utils/mcp-result.js";
import { getCurrentUser } from "./get-current-user.js";

export type ToolClient = {
  readonly usingApiKey?: boolean;
  json<T = unknown>(path: string, init?: RequestInit): Promise<T>;
};
export type ToolRegistrar = {
  registerTool(
    name: string,
    config: { description: string; inputSchema: z.ZodObject },
    callback: (args: unknown) => Promise<CallToolResult>,
  ): unknown;
};

const prioritySchema = z.enum([
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
]);

const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional();
const nullableOptionalNonEmptyString = nonEmptyString.nullable().optional();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const optionalIsoDateTimeSchema = isoDateTimeSchema.optional();
const nullableOptionalIsoDateTimeSchema = isoDateTimeSchema
  .nullable()
  .optional();
const hexColorSchema = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    "Expected a hex color like #FF6600",
  );

const OUTCOME_NOTE =
  ' Read `outcome` in the result. "applied" means the change is made. "requested" means you are not involved in the task (not its creator, its assignee, or a workspace owner or admin): nothing changed yet, and `request` holds a change request that its creator, assignee or an admin can accept. Tell the user it is waiting for them; use get_change_request to follow it.';

function run(fn: () => Promise<unknown>): Promise<CallToolResult> {
  return fn()
    .then((data) => textResult(data))
    .catch((e: unknown) =>
      errorResult(e instanceof Error ? e.message : String(e)),
    );
}

export function registerTools(
  server: ToolRegistrar,
  ctx: { client: ToolClient },
): void {
  const { client } = ctx;
  const registerTool = <S extends z.ZodObject>(
    name: string,
    config: { description: string; inputSchema: S },
    callback: (args: z.output<S>) => Promise<CallToolResult>,
  ) =>
    server.registerTool(name, config, async (args) => {
      const parsed = config.inputSchema.safeParse(args);
      if (!parsed.success) return errorResult(z.prettifyError(parsed.error));
      return callback(parsed.data);
    });

  registerTool(
    "whoami",
    {
      description:
        "Return the current Baton user for the configured authentication method.",
      inputSchema: z.object({}),
    },
    async () => run(() => getCurrentUser(client)),
  );

  registerTool(
    "list_workspaces",
    {
      description:
        "List workspaces (Better Auth organizations) the signed-in user can access.",
      inputSchema: z.object({}),
    },
    async () =>
      run(() => client.json("/api/auth/organization/list", { method: "GET" })),
  );

  registerTool(
    "list_projects",
    {
      description: "List projects in a workspace.",
      inputSchema: z.object({
        workspaceId: nonEmptyString.describe("Workspace ID"),
        includeArchived: z
          .boolean()
          .optional()
          .describe("Include archived projects"),
      }),
    },
    async (args) => {
      const { workspaceId, includeArchived } = args;
      const qs = new URLSearchParams({ workspaceId });
      if (includeArchived === true) {
        qs.set("includeArchived", "true");
      }
      return run(() =>
        client.json(`/api/project?${qs.toString()}`, { method: "GET" }),
      );
    },
  );

  registerTool(
    "get_project",
    {
      description: "Get a single project by ID.",
      inputSchema: z.object({ id: nonEmptyString }),
    },
    async (args) =>
      run(() => client.json(`/api/project/${encodeURIComponent(args.id)}`)),
  );

  registerTool(
    "create_project",
    {
      description: "Create a project in a workspace.",
      inputSchema: z.object({
        name: nonEmptyString,
        workspaceId: nonEmptyString,
        icon: nonEmptyString,
        slug: nonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json("/api/project", {
          method: "POST",
          body: JSON.stringify({
            name: args.name,
            workspaceId: args.workspaceId,
            icon: args.icon,
            slug: args.slug,
          }),
        }),
      ),
  );

  registerTool(
    "update_project",
    {
      description:
        "Update project metadata (PATCH-style: only provided fields are changed).",
      inputSchema: z.object({
        id: nonEmptyString,
        name: optionalNonEmptyString,
        icon: z.string().optional(),
        slug: optionalNonEmptyString,
        description: z.string().optional(),
      }),
    },
    async (args) => {
      const { id, ...patch } = args;
      return run(async () => {
        const existing = (await client.json(
          `/api/project/${encodeURIComponent(id)}`,
          { method: "GET" },
        )) as Record<string, unknown>;
        const name =
          patch.name ??
          (typeof existing.name === "string" ? existing.name : "");
        if (!name) {
          throw new Error("Cannot update project: missing name.");
        }
        const icon =
          patch.icon !== undefined
            ? patch.icon
            : typeof existing.icon === "string"
              ? existing.icon
              : "Layout";
        const slug =
          patch.slug ??
          (typeof existing.slug === "string" ? existing.slug : "");
        if (!slug) {
          throw new Error("Cannot update project: missing slug.");
        }
        const description =
          patch.description !== undefined
            ? patch.description
            : typeof existing.description === "string"
              ? existing.description
              : "";
        const body = { name, icon, slug, description };

        return client.json(`/api/project/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      });
    },
  );

  const listTasksSchema = z.object({
    projectId: nonEmptyString,
    status: optionalNonEmptyString,
    priority: prioritySchema.optional(),
    assigneeId: optionalNonEmptyString,
    page: z.number().int().min(1).max(1_000_000).optional(),
    relatedPage: z.number().int().min(1).max(1_000_000).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    sortBy: z
      .enum(["createdAt", "priority", "dueDate", "position", "title", "number"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    dueBefore: optionalIsoDateTimeSchema,
    dueAfter: optionalIsoDateTimeSchema,
  });

  registerTool(
    "list_tasks",
    {
      description:
        "List a bounded page of tasks for a project (50 by default, maximum 100). Use pagination.totalPages and page to retrieve the rest; filters and sorting apply before pagination. For every task page, also follow relatedPage through pagination.relatedTotalPages for complete labels, links and column metadata.",
      inputSchema: listTasksSchema,
    },
    async (args) => {
      const { projectId, ...rest } = args;
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(rest)) {
        if (v === undefined || v === null) {
          continue;
        }
        qs.set(k, String(v));
      }
      const q = qs.toString();
      const path = `/api/task/tasks/${encodeURIComponent(projectId)}${q ? `?${q}` : ""}`;
      return run(() => client.json(path, { method: "GET" }));
    },
  );

  registerTool(
    "get_task",
    {
      description: "Get a task by ID.",
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/${encodeURIComponent(args.taskId)}`, {
          method: "GET",
        }),
      ),
  );

  registerTool(
    "get_task_by_ticket_id",
    {
      description:
        "Get one task by its ticket ID (project key and number, e.g. KAN-12). If multiple accessible tasks share the ID, provide workspaceId or projectId.",
      inputSchema: z.object({
        ticketId: nonEmptyString,
        workspaceId: optionalNonEmptyString,
        projectId: optionalNonEmptyString,
      }),
    },
    async ({ ticketId, workspaceId, projectId }) => {
      const query = new URLSearchParams();
      if (workspaceId) query.set("workspaceId", workspaceId);
      if (projectId) query.set("projectId", projectId);
      const suffix = query.toString();
      return run(() =>
        client.json(
          `/api/task/by-ticket-id/${encodeURIComponent(ticketId)}${suffix ? `?${suffix}` : ""}`,
          { method: "GET" },
        ),
      );
    },
  );

  registerTool(
    "create_task",
    {
      description: "Create a task in a project.",
      inputSchema: z.object({
        projectId: nonEmptyString,
        title: nonEmptyString,
        description: z.string(),
        priority: prioritySchema,
        status: nonEmptyString,
        startDate: optionalIsoDateTimeSchema,
        dueDate: optionalIsoDateTimeSchema,
        userId: optionalNonEmptyString,
      }),
    },
    async (args) => {
      const body: Record<string, string | undefined> = {
        title: args.title,
        description: args.description,
        priority: args.priority,
        status: args.status,
      };
      if (args.startDate !== undefined) {
        body.startDate = args.startDate;
      }
      if (args.dueDate !== undefined) {
        body.dueDate = args.dueDate;
      }
      if (args.userId !== undefined) {
        body.userId = args.userId;
      }
      return run(() =>
        client.json(`/api/task/${encodeURIComponent(args.projectId)}`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    },
  );

  registerTool(
    "duplicate_task",
    {
      description:
        "Duplicate a task in the same project, copying its fields and labels. Pass title to rename the copy.",
      inputSchema: z.object({
        taskId: nonEmptyString,
        title: optionalNonEmptyString,
      }),
    },
    async (args) => {
      const body: Record<string, string> = {};
      if (args.title !== undefined) {
        body.title = args.title;
      }
      return run(() =>
        client.json(`/api/task/duplicate/${encodeURIComponent(args.taskId)}`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    },
  );

  const updateTaskSchema = z.object({
    taskId: nonEmptyString,
    title: optionalNonEmptyString,
    description: z.string().nullable().optional(),
    status: optionalNonEmptyString,
    priority: prioritySchema.optional(),
    projectId: optionalNonEmptyString,
    position: z.number().optional(),
    startDate: nullableOptionalIsoDateTimeSchema,
    dueDate: nullableOptionalIsoDateTimeSchema,
    userId: nullableOptionalNonEmptyString,
  });

  registerTool(
    "update_task",
    {
      description: `Update a task (fetches current task, merges fields, then full update). Only someone involved in the task can reassign it. A status change by someone else becomes a change request; the other fields still apply.${OUTCOME_NOTE}`,
      inputSchema: updateTaskSchema,
    },
    async (args) => {
      const { taskId, ...patch } = args;
      return run(async () => {
        const existing = (await client.json(
          `/api/task/${encodeURIComponent(taskId)}`,
          { method: "GET" },
        )) as Record<string, unknown>;
        const body = buildFullTaskUpdateBody(existing, patch);
        return client.json(`/api/task/${encodeURIComponent(taskId)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      });
    },
  );

  registerTool(
    "move_task",
    {
      description:
        "Move a task to another project (and optional column status). If you are not involved in the task, a move that changes its status or drops its assignee is refused; ask with update_task_status instead.",
      inputSchema: z.object({
        taskId: nonEmptyString,
        destinationProjectId: nonEmptyString,
        destinationStatus: optionalNonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/move/${encodeURIComponent(args.taskId)}`, {
          method: "PUT",
          body: JSON.stringify({
            destinationProjectId: args.destinationProjectId,
            ...(args.destinationStatus !== undefined
              ? { destinationStatus: args.destinationStatus }
              : {}),
          }),
        }),
      ),
  );

  registerTool(
    "update_task_status",
    {
      description: `Update only the status (column) of a task. A blocked task cannot be set to a final column.${OUTCOME_NOTE} An unanswered status request applies after 24 hours, unless it targets a final column or archived; those expire.`,
      inputSchema: z.object({
        taskId: nonEmptyString,
        status: nonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/status/${encodeURIComponent(args.taskId)}`, {
          method: "PUT",
          body: JSON.stringify({ status: args.status }),
        }),
      ),
  );

  const changeRequestId = z.object({ requestId: nonEmptyString });

  registerTool(
    "list_change_requests",
    {
      description:
        "List change requests in a workspace, newest first. A change request is a status change or delete asked for by someone not involved in the task; its creator, assignee or a workspace owner or admin accepts or rejects it. Use canAnswer: true for the requests waiting on the caller, and mine: true for the caller's own. state is one of pending, accepted, rejected, cancelled, expired, applied_on_timeout.",
      inputSchema: z.object({
        workspaceId: nonEmptyString,
        taskId: optionalNonEmptyString,
        state: optionalNonEmptyString,
        canAnswer: z.boolean().optional(),
        mine: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).max(100_000).optional(),
      }),
    },
    async (args) => {
      const qs = new URLSearchParams({ workspaceId: args.workspaceId });
      if (args.taskId) qs.set("taskId", args.taskId);
      if (args.state) qs.set("state", args.state);
      if (args.canAnswer) qs.set("canAnswer", "me");
      if (args.mine) qs.set("requestedBy", "me");
      if (args.limit !== undefined) qs.set("limit", String(args.limit));
      if (args.offset !== undefined) qs.set("offset", String(args.offset));
      return run(() =>
        client.json(`/api/task-change-request?${qs.toString()}`),
      );
    },
  );

  registerTool(
    "get_change_request",
    {
      description:
        "Get one change request and its state. Works after the task is deleted, so you can learn how your request ended.",
      inputSchema: changeRequestId,
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/task-change-request/${encodeURIComponent(args.requestId)}`,
        ),
      ),
  );

  registerTool(
    "answer_change_request",
    {
      description:
        "Accept or reject a pending change request. Only the task's creator, its assignee, or a workspace owner or admin can answer. Answer only when your user asks you to. Accepting makes the change now. If the task changed since the request was made, accepting cancels the request instead; read `request.state` in the result.",
      inputSchema: changeRequestId.extend({
        decision: z.enum(["accept", "reject"]),
      }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/task-change-request/${encodeURIComponent(args.requestId)}/${args.decision}`,
          { method: "POST", body: JSON.stringify({}) },
        ),
      ),
  );

  registerTool(
    "cancel_change_request",
    {
      description: "Withdraw one of your own pending change requests.",
      inputSchema: changeRequestId,
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/task-change-request/${encodeURIComponent(args.requestId)}/cancel`,
          { method: "POST", body: JSON.stringify({}) },
        ),
      ),
  );

  registerTool(
    "list_task_comments",
    {
      description: "List comments on a task.",
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/comment/${encodeURIComponent(args.taskId)}`, {
          method: "GET",
        }),
      ),
  );

  registerTool(
    "create_task_comment",
    {
      description: "Add a comment to a task.",
      inputSchema: z.object({
        taskId: nonEmptyString,
        content: nonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/comment/${encodeURIComponent(args.taskId)}`, {
          method: "POST",
          body: JSON.stringify({ content: args.content }),
        }),
      ),
  );

  registerTool(
    "update_task_comment",
    {
      description: "Update one of your comments on a task.",
      inputSchema: z.object({
        commentId: nonEmptyString,
        content: nonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/comment/${encodeURIComponent(args.commentId)}`, {
          method: "PUT",
          body: JSON.stringify({ content: args.content }),
        }),
      ),
  );

  registerTool(
    "delete_task_comment",
    {
      description: "Delete one of your comments from a task.",
      inputSchema: z.object({ commentId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/comment/${encodeURIComponent(args.commentId)}`, {
          method: "DELETE",
        }),
      ),
  );

  registerTool(
    "list_workspace_labels",
    {
      description: "List labels defined in a workspace.",
      inputSchema: z.object({ workspaceId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/label/workspace/${encodeURIComponent(args.workspaceId)}`,
          { method: "GET" },
        ),
      ),
  );

  registerTool(
    "create_label",
    {
      description:
        "Create a label in a workspace (optionally attach to a task).",
      inputSchema: z.object({
        name: nonEmptyString,
        color: hexColorSchema,
        workspaceId: nonEmptyString,
        taskId: optionalNonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json("/api/label", {
          method: "POST",
          body: JSON.stringify({
            name: args.name,
            color: args.color,
            workspaceId: args.workspaceId,
            ...(args.taskId !== undefined ? { taskId: args.taskId } : {}),
          }),
        }),
      ),
  );

  registerTool(
    "attach_label_to_task",
    {
      description: "Attach an existing label to a task.",
      inputSchema: z.object({
        labelId: nonEmptyString,
        taskId: nonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/label/${encodeURIComponent(args.labelId)}/task`, {
          method: "PUT",
          body: JSON.stringify({ taskId: args.taskId }),
        }),
      ),
  );

  registerTool(
    "detach_label_from_task",
    {
      description: "Detach a label from its current task.",
      inputSchema: z.object({ labelId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/label/${encodeURIComponent(args.labelId)}/task`, {
          method: "DELETE",
        }),
      ),
  );

  registerTool(
    "create_task_relation",
    {
      description:
        "Create a relation between two tasks. relationType: 'subtask' (sourceTaskId is the parent, targetTaskId the child), 'blocks' (sourceTaskId blocks targetTaskId), or 'related' (bidirectional).",
      inputSchema: z.object({
        sourceTaskId: nonEmptyString,
        targetTaskId: nonEmptyString,
        relationType: z.enum(["subtask", "blocks", "related"]),
      }),
    },
    async (args) =>
      run(() =>
        client.json("/api/task-relation", {
          method: "POST",
          body: JSON.stringify({
            sourceTaskId: args.sourceTaskId,
            targetTaskId: args.targetTaskId,
            relationType: args.relationType,
          }),
        }),
      ),
  );

  registerTool(
    "get_task_relations",
    {
      description:
        "List all relations (subtask/blocks/related) involving a task.",
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task-relation/${encodeURIComponent(args.taskId)}`, {
          method: "GET",
        }),
      ),
  );

  registerTool(
    "get_board",
    {
      description:
        "Get the workspace board. Words the team uses: a TASK is one job with one owner. A FEATURE is a job that has tasks under it; each of those tasks has its own owner and lives in a repo (App, API, Engine...) or in no repo (QA, design). In this response every top-level entry of `tasks` is a task or a feature, and its `subtasks` array holds the tasks under a feature (empty for a single task). Each has a `key` such as T-5 or API-3, a status, `dueDate`, `finishedAt` (when it reached done; null while open) and pull requests. `waitsOn` lists the open tasks that block an item, in any repo or feature; `hiddenBlockers` counts open blockers in repos you cannot see. An item is blocked when either is non-empty: it can start but cannot be set to done. `blockedBy` on a subtask is map edges only, not a blocked signal. `column` is where the entry sits on the board (todo, doing, review, done); for a feature it follows its tasks: done when all are done, review when every unfinished one is in review, doing once any has started. A blocked item stays in its column. `projects` lists where a task under a feature can live: kind `repo` for repos, kind `board` for no repo. `members` lists everyone with the user id that assignment tools accept. `pendingRequest` is a status or delete change request waiting for an answer, or null. get_task_by_ticket_id finds one item by key.",
      inputSchema: z.object({ workspaceId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/board/workspace/${encodeURIComponent(args.workspaceId)}`,
          { method: "GET" },
        ),
      ),
  );

  const subtaskPlan = z.object({
    title: nonEmptyString,
    description: z.string().optional(),
    repo: z
      .string()
      .optional()
      .describe(
        "Repo key or name, for example APP, API or ENG. Leave out, or use 'none', for work with no repo (QA, design, ops).",
      ),
    owner: z
      .string()
      .optional()
      .describe("First name, full name or email of one person."),
    status: z.string().optional(),
    waitsOn: z
      .array(z.union([z.string(), z.number().int().min(1)]))
      .optional()
      .describe(
        "What must be finished first: a ticket key (API-3), the title of another task in this call, or its position (1 is the first).",
      ),
  });

  registerTool(
    "create_board_task",
    {
      description:
        "Create a task or a feature on the board in ONE call. A TASK is one job: give a title and an owner, and no `subtasks`. A FEATURE is a job with tasks under it: list them in `subtasks`, each with its own owner and repo, and say what waits on what. Use names or ids: owner 'Aakash', repo 'API'. One task has one owner. If a name is wrong nothing is created, and the error lists the valid names.",
      inputSchema: z.object({
        workspaceId: nonEmptyString,
        title: nonEmptyString,
        description: z.string().optional(),
        owner: z
          .string()
          .optional()
          .describe("First name, full name or email of one person."),
        subtasks: z.array(subtaskPlan).max(50).optional(),
      }),
    },
    async ({ workspaceId, ...body }) =>
      run(() =>
        client.json(
          `/api/board/workspace/${encodeURIComponent(workspaceId)}/plan`,
          { method: "POST", body: JSON.stringify(body) },
        ),
      ),
  );

  registerTool(
    "add_subtasks",
    {
      description:
        "Add one or more tasks under an existing task or feature, found by its key (for example T-5). A single task that gets its first task under it becomes a feature. Same fields as `subtasks` in create_board_task: names or ids for owner and repo, and waitsOn for what must be finished first.",
      inputSchema: z.object({
        workspaceId: nonEmptyString,
        taskKey: nonEmptyString,
        subtasks: z.array(subtaskPlan).min(1).max(50),
      }),
    },
    async ({ workspaceId, taskKey, subtasks }) =>
      run(() =>
        client.json(
          `/api/board/workspace/${encodeURIComponent(workspaceId)}/item/${encodeURIComponent(taskKey)}/subtasks`,
          { method: "POST", body: JSON.stringify({ subtasks }) },
        ),
      ),
  );

  registerTool(
    "update_board_item",
    {
      description: `Change a task or feature found by its key (T-5, API-3): set its status, its owner, or what it waits on. Status takes everyday words: todo, in progress, review, done. A blocked task cannot be set to done; the error names what blocks it. A feature has no status of its own: it follows its tasks. Only someone involved in the task can change its owner. To edit a title, description or comments, use the task tools with the returned id.${OUTCOME_NOTE}`,
      inputSchema: z.object({
        workspaceId: nonEmptyString,
        key: nonEmptyString,
        status: z.string().optional(),
        owner: z
          .string()
          .nullable()
          .optional()
          .describe("A person's name or email, or null to remove the owner."),
        waitsOn: z
          .array(z.string())
          .optional()
          .describe("Ticket keys of tasks that must be finished first."),
      }),
    },
    async ({ workspaceId, key, ...body }) =>
      run(() =>
        client.json(
          `/api/board/workspace/${encodeURIComponent(workspaceId)}/item/${encodeURIComponent(key)}`,
          { method: "PATCH", body: JSON.stringify(body) },
        ),
      ),
  );

  registerTool(
    "get_team_history",
    {
      description:
        "Per person in a workspace: how many tasks they finished in the last N days (default 30), split by repo, their most recent finished tasks, and their current open count. A feature is not counted itself; the tasks under it are. Use it to answer 'who did what' and 'how much did X ship'.",
      inputSchema: z.object({
        workspaceId: nonEmptyString,
        days: z.number().int().min(1).max(365).optional(),
      }),
    },
    async ({ workspaceId, days }) =>
      run(() =>
        client.json(
          `/api/board/workspace/${encodeURIComponent(workspaceId)}/history${days ? `?days=${days}` : ""}`,
          { method: "GET" },
        ),
      ),
  );

  registerTool(
    "list_my_tasks",
    {
      description:
        "List the open tasks assigned to the caller across every active project in a workspace, ordered by due date then priority (at most 100). Each task has `dueDate`, `waiting` (open tasks that wait on it, so someone waits on the caller; tasks in repos the caller cannot see are left out), `waitsOn` (open tasks it waits on, in any repo) and `hiddenBlockers` (a count of open blockers in repos the caller cannot see). A task with blockers can start but cannot be set to done. `pendingRequest` is a change request waiting on the task, or null; answer it with answer_change_request.",
      inputSchema: z.object({ workspaceId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/task/assigned?workspaceId=${encodeURIComponent(args.workspaceId)}`,
          { method: "GET" },
        ),
      ),
  );

  registerTool(
    "delete_task_relation",
    {
      description: "Delete a task relation by its relation ID.",
      inputSchema: z.object({ id: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task-relation/${encodeURIComponent(args.id)}`, {
          method: "DELETE",
        }),
      ),
  );

  registerTool(
    "delete_label",
    {
      description:
        "Delete a task or workspace label by ID. Workspace-label cascades resume automatically; repeat the tool if pendingDeletion remains true.",
      inputSchema: z.object({ id: nonEmptyString }),
    },
    async (args) =>
      run(async () => {
        let result: unknown;
        const signal = AbortSignal.timeout(10_000);
        // Bound work per tool call. The API persists the continuation boundary.
        for (let page = 0; page < 100; page++) {
          if (page > 0 && signal.aborted) break;
          try {
            result = await client.json(
              `/api/label/${encodeURIComponent(args.id)}`,
              { method: "DELETE", signal },
            );
          } catch (error) {
            if (signal.aborted && result) break;
            throw error;
          }
          if (
            !result ||
            typeof result !== "object" ||
            !("pendingDeletion" in result) ||
            !result.pendingDeletion
          )
            break;
        }
        return result;
      }),
  );

  registerTool(
    "list_workspace_members",
    {
      description:
        "List the members of a workspace. Use this to resolve the user ID an assignee tool expects.",
      inputSchema: z.object({ workspaceId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/workspace/${encodeURIComponent(args.workspaceId)}/members`,
        ),
      ),
  );

  registerTool(
    "search",
    {
      description:
        "Search across tasks, projects, workspaces, comments, and activities.",
      inputSchema: z.object({
        q: nonEmptyString.describe("Search query"),
        type: z
          .enum([
            "all",
            "tasks",
            "projects",
            "workspaces",
            "comments",
            "activities",
          ])
          .optional()
          .describe("Restrict results to one kind. Defaults to all."),
        workspaceId: optionalNonEmptyString.describe("Limit to one workspace"),
        projectId: optionalNonEmptyString.describe("Limit to one project"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximum results, 1 to 50. Defaults to 20."),
      }),
    },
    async (args) => {
      const qs = new URLSearchParams({ q: args.q });
      if (args.type) qs.set("type", args.type);
      if (args.workspaceId) qs.set("workspaceId", args.workspaceId);
      if (args.projectId) qs.set("projectId", args.projectId);
      if (args.limit !== undefined) qs.set("limit", String(args.limit));
      return run(() => client.json(`/api/search?${qs.toString()}`));
    },
  );

  registerTool(
    "list_project_columns",
    {
      description:
        "List a project's columns. Their slugs are the values update_task_status and create_task accept as a status.",
      inputSchema: z.object({ projectId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/column/${encodeURIComponent(args.projectId)}`),
      ),
  );

  registerTool(
    "delete_task",
    {
      description: `Delete a task by ID.${OUTCOME_NOTE} An unanswered delete request expires after 24 hours.`,
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/${encodeURIComponent(args.taskId)}`, {
          method: "DELETE",
        }),
      ),
  );

  registerTool(
    "update_task_assignee",
    {
      description:
        "Assign a task to a workspace member, or pass a null userId to unassign it. Only the task's creator, its assignee, or a workspace owner or admin can change who owns it.",
      inputSchema: z.object({
        taskId: nonEmptyString,
        userId: nonEmptyString
          .nullable()
          .describe("Member user ID, or null to unassign"),
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/assignee/${encodeURIComponent(args.taskId)}`, {
          method: "PUT",
          body: JSON.stringify({ userId: args.userId }),
        }),
      ),
  );

  registerTool(
    "update_task_due_date",
    {
      description: "Set a task's due date. Omit dueDate to clear it.",
      inputSchema: z.object({
        taskId: nonEmptyString,
        dueDate: optionalIsoDateTimeSchema,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/due-date/${encodeURIComponent(args.taskId)}`, {
          method: "PUT",
          body: JSON.stringify(
            args.dueDate === undefined ? {} : { dueDate: args.dueDate },
          ),
        }),
      ),
  );

  registerTool(
    "list_task_activity",
    {
      description: "List a task's activity history.",
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/activity/${encodeURIComponent(args.taskId)}`),
      ),
  );

  registerTool(
    "list_notifications",
    {
      description: "List the signed-in user's notifications.",
      inputSchema: z.object({}),
    },
    async () => run(() => client.json("/api/notification")),
  );
}
