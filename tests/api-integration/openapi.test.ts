import { beforeAll, describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";

type Operation = {
  operationId?: string;
  summary?: string;
  responses: Record<string, unknown>;
  security?: unknown[];
};
type Spec = {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
  security?: Array<Record<string, unknown>>;
  components: {
    responses: Record<
      string,
      { headers?: Record<string, unknown>; content?: Record<string, unknown> }
    >;
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, { type: string; scheme?: string }>;
  };
};

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

function operations(spec: Spec): Array<[string, string, Operation]> {
  const out: Array<[string, string, Operation]> = [];
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (HTTP_METHODS.includes(method)) out.push([method, path, operation]);
    }
  }
  return out;
}

let spec: Spec;

beforeAll(async () => {
  const { app } = createApp();
  const response = await app.request("/api/openapi");
  expect(response.status).toBe(200);
  spec = (await response.json()) as Spec;
});

describe("Baton API OpenAPI spec", () => {
  it("is a valid OpenAPI 3.1 document", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Baton API");
  });

  it("requires bearer auth globally", () => {
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(spec.security).toContainEqual({ bearerAuth: [] });
  });

  it("documents the routes the clients depend on", () => {
    const keys = new Set(
      operations(spec).map(
        ([method, path]) => `${method.toUpperCase()} ${path}`,
      ),
    );
    for (const op of [
      "GET /config",
      "GET /github-integration/project/{projectId}",
      "POST /github-integration/project/{projectId}",
      "PATCH /github-integration/project/{projectId}",
      "DELETE /github-integration/project/{projectId}",
      "GET /slack-dm/me",
      "PUT /slack-dm/me",
      "GET /label/{id}",
      "POST /label",
      "GET /project",
      "GET /task/tasks/{projectId}",
      "PATCH /task/bulk",
      "GET /search",
      "GET /notification",
      "GET /workspace",
      "GET /workspace/{workspaceId}",
      "POST /workspace",
      "PATCH /workspace/{workspaceId}",
      "DELETE /workspace/{workspaceId}",
      "POST /workspace/{workspaceId}/leave",
      "DELETE /workspace/{workspaceId}/members/{userId}",
      "PUT /workspace/{workspaceId}/members/{userId}/role",
      "PUT /workspace/{workspaceId}/owner",
      "GET /workspace/{workspaceId}/roles",
      "POST /workspace/{workspaceId}/roles",
      "PATCH /workspace/{workspaceId}/roles/{roleId}",
      "DELETE /workspace/{workspaceId}/roles/{roleId}",
    ]) {
      expect(keys.has(op), `missing operation ${op}`).toBe(true);
    }
  });

  it("documents no route for a removed feature", () => {
    const removed =
      /^\/(time-entry|custom-field|public-project|calendar-feed|billing|creem|import|planka|trello|device|gitea-integration|gitlab-integration|discord-integration|telegram-integration|mattermost-integration|slack-integration|generic-webhook-integration)(\/|$)|\/(sign-in\/(anonymous|social|magic-link|email-otp|oauth2)|email-otp\/|device\/)/;
    const paths = operations(spec).map(([, path]) => path);
    expect(paths.filter((path) => removed.test(path))).toEqual([]);
  });

  it("gives every operation a unique operationId and a summary", () => {
    const ids: string[] = [];
    for (const [method, path, operation] of operations(spec)) {
      expect(
        operation.operationId,
        `${method} ${path} has no operationId`,
      ).toBeTruthy();
      expect(
        operation.summary,
        `${method} ${path} has no summary`,
      ).toBeTruthy();
      ids.push(operation.operationId as string);
    }
    expect(new Set(ids).size, "operationIds must be unique").toBe(ids.length);
  });

  it("documents the join-link routes, with only the preview public", () => {
    const byKey = new Map(
      operations(spec).map(([method, path, operation]) => [
        `${method.toUpperCase()} ${path}`,
        operation,
      ]),
    );
    for (const op of [
      "GET /join-link/workspace/{workspaceId}",
      "POST /join-link/workspace/{workspaceId}",
      "DELETE /join-link/workspace/{workspaceId}",
      "POST /join-link/preview",
      "POST /join-link/join",
    ])
      expect(byKey.has(op), `missing operation ${op}`).toBe(true);
    expect(byKey.get("POST /join-link/preview")?.security).toEqual([]);
    expect(byKey.get("POST /join-link/join")?.security).toBeUndefined();
  });

  it("documents change requests and the applied or requested outcome", () => {
    const keys = new Set(
      operations(spec).map(
        ([method, path]) => `${method.toUpperCase()} ${path}`,
      ),
    );
    for (const op of [
      "GET /task-change-request",
      "GET /task-change-request/{id}",
      "POST /task-change-request/{id}/accept",
      "POST /task-change-request/{id}/reject",
      "POST /task-change-request/{id}/cancel",
    ])
      expect(keys.has(op), `missing operation ${op}`).toBe(true);

    const schemaOf = (operation: Operation | undefined, status: string) =>
      JSON.stringify(
        (
          operation?.responses[status] as
            | { content?: Record<string, { schema?: unknown }> }
            | undefined
        )?.content?.["application/json"]?.schema ?? null,
      );
    for (const [method, path, applied, requested] of [
      [
        "put",
        "/task/status/{id}",
        "TaskStatusChangeApplied",
        "TaskStatusChangeRequested",
      ],
      ["put", "/task/{id}", "TaskUpdateApplied", "TaskUpdateRequested"],
      ["delete", "/task/{id}", "TaskDeleteApplied", "TaskDeleteRequested"],
      [
        "patch",
        "/board/workspace/{workspaceId}/item/{key}",
        "BoardItemUpdated",
        "BoardItemChangeRequested",
      ],
    ]) {
      const operation = spec.paths[path]?.[method];
      expect(schemaOf(operation, "200"), `${method} ${path} 200`).toContain(
        applied,
      );
      expect(schemaOf(operation, "202"), `${method} ${path} 202`).toContain(
        requested,
      );
    }
    expect(Object.keys(spec.components.schemas)).toEqual(
      expect.arrayContaining([
        "TaskChangeRequest",
        "PendingChangeRequest",
        "TaskChangeRequestDecision",
      ]),
    );
    expect(JSON.stringify(spec.components.schemas.AssignedTask)).toContain(
      "pendingRequest",
    );
  });

  it("describes the board's done window, the one-item read and status capability", () => {
    const getBoard = spec.paths["/board/workspace/{workspaceId}"]?.get as
      | (Operation & { parameters?: Array<{ name: string; in: string }> })
      | undefined;
    expect(getBoard?.parameters?.find((p) => p.name === "doneSince")?.in).toBe(
      "query",
    );
    expect(getBoard?.responses["400"]).toBeTruthy();
    const board = JSON.stringify(spec.components.schemas.TaskBoard);
    expect(board).toContain("olderDoneCount");
    expect(board).toContain("doneSince");

    const item = spec.paths["/board/workspace/{workspaceId}/item/{key}"]?.get;
    expect(item?.operationId).toBe("getBoardItem");
    expect(JSON.stringify(item?.responses["200"])).toContain("BoardItem");
    expect(item?.responses["404"]).toBeTruthy();

    expect(JSON.stringify(spec.components.schemas.StatusChange)).toContain(
      "deny",
    );
    for (const name of [
      "WorkspaceBoardTask",
      "BoardSubtask",
      "TaskWithAssignee",
    ]) {
      const schema = JSON.stringify(spec.components.schemas[name]);
      expect(schema, name).toContain("statusGeneration");
      expect(schema, name).toContain("StatusChange");
    }
    expect(JSON.stringify(spec.components.schemas.TaskByTicketId)).toContain(
      "#/components/schemas/TaskWithAssignee",
    );
    // The workspace board item has its own component, not the per-project
    // project board's `BoardTask`.
    expect(board).toContain("#/components/schemas/WorkspaceBoardTask");
    expect(JSON.stringify(spec.components.schemas.BoardItem)).toContain(
      "WorkspaceBoardTask",
    );
    expect(
      JSON.stringify(spec.components.schemas.TaskStatusChangeApplied),
    ).toContain("statusGeneration");
    expect(
      JSON.stringify(spec.components.schemas.TaskUpdateApplied),
    ).not.toContain("statusGeneration");
    expect(JSON.stringify(spec.components.schemas.RelatedTask)).toContain(
      '"open"',
    );
  });

  it("names its entity schemas as reusable components", () => {
    expect(Object.keys(spec.components.schemas)).toEqual(
      expect.arrayContaining([
        "Task",
        "Project",
        "Label",
        "Column",
        "Comment",
        "Activity",
        "Notification",
        "Config",
        "SearchResult",
        "Workspace",
        "WorkspaceMember",
        "GitHubIntegration",
      ]),
    );
  });

  it("documents Baton errors as ApiError JSON", () => {
    expect(spec.components.schemas.ApiError).toMatchObject({
      type: "object",
      required: ["message", "code"],
    });
    const plainText: string[] = [];
    for (const [method, path, operation] of operations(spec)) {
      if (path.startsWith("/mcp/")) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!/^[45]/.test(status)) continue;
        const ref = (response as { $ref?: string }).$ref;
        const content = (
          ref
            ? spec.components.responses[ref.split("/").pop() ?? ""]
            : (response as { content?: Record<string, unknown> })
        )?.content;
        if (!content?.["application/json"])
          plainText.push(`${method.toUpperCase()} ${path} ${status}`);
      }
    }
    expect(plainText).toEqual([]);
    expect(spec.paths["/task/{id}"]?.get?.responses["401"]).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ApiError" },
        },
      },
    });
  });

  it("documents a 401 on every operation that requires auth", () => {
    const missing: string[] = [];
    for (const [method, path, operation] of operations(spec)) {
      const isPublic =
        Array.isArray(operation.security) && operation.security.length === 0;
      if (isPublic) continue;
      if (!operation.responses["401"])
        missing.push(`${method.toUpperCase()} ${path}`);
    }
    expect(missing).toEqual([]);
  });

  it("documents the API key rate limit on every operation that requires auth", () => {
    expect(
      Object.keys(
        spec.components.responses.ApiKeyRateLimited?.headers ?? {},
      ).sort(),
    ).toEqual([
      "Retry-After",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ]);
    expect(spec.components.responses.ApiKeyRateLimited?.content).toEqual({
      "application/json": {
        schema: { $ref: "#/components/schemas/ApiError" },
      },
    });
    const missing: string[] = [];
    for (const [method, path, operation] of operations(spec)) {
      const isPublic =
        Array.isArray(operation.security) && operation.security.length === 0;
      if (isPublic) continue;
      if (!operation.responses["429"])
        missing.push(`${method.toUpperCase()} ${path}`);
    }
    expect(missing).toEqual([]);
    expect(spec.paths["/project"]?.get?.responses["429"]).toEqual({
      $ref: "#/components/responses/ApiKeyRateLimited",
    });
  });

  it("documents the API key rate limit on public routes that read an API key", () => {
    const byId = new Map(
      operations(spec).map(([, , operation]) => [
        operation.operationId,
        operation,
      ]),
    );
    expect(byId.get("getAsset")?.responses["429"]).toEqual({
      $ref: "#/components/responses/ApiKeyRateLimited",
    });
    // get-session refuses a key before it spends quota.
    expect(byId.get("getSession")?.responses["403"]).toBeDefined();
    for (const id of [
      "getSession",
      "getInstanceStatus",
      "getUserAvatar",
      "getConfig",
    ]) {
      expect(byId.get(id)?.responses["429"], id).toBeUndefined();
    }
  });
});
