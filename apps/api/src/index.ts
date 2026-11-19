import { startWebhookWorker } from "./admin/webhooks/start-webhook-worker";
import { startOutboxRelay } from "./events/outbox/start-relay";
import integrationSync from "./integration-sync";
import { syncWorkspaceAccess } from "./ws/workspace-access";
import { drainPasswordResetDeliveries } from "./utils/password-reset-delivery";

import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Identity } from "./identity/port";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import activity from "./activity";
import admin from "./admin";
import { forwardAuthRequest } from "./utils/forward-auth-request";
import column from "./column";
import comment from "./comment";
import config from "./config";
import db, { getDatabase, schema } from "./database";
import { apiErrorSchema } from "./errors/api-error-schema";
import { httpExceptionResponse } from "./errors/http-exception-response";
import { notFoundResponse } from "./errors/not-found-response";
import { logger } from "./observability/logger";
import { reportRequestError } from "./observability/report-error";
import { requestContext } from "./observability/request-context-middleware";
import { setWorkspaceContext } from "./observability/workspace-context";
import { validationHook } from "./errors/validation-error";
import { prepareDatabaseStartup } from "./database/prepare-database-startup";
import { waitForDatabase } from "./database/wait-for-database";
import { eventContext } from "./events";
import externalLink from "./external-link";
import githubIntegration, {
  handleGithubWebhookRoute,
} from "./github-integration";
import getInstanceStatus from "./instance/controllers/get-instance-status";
import joinLink from "./join-link";
import joinLinkPublic from "./join-link/public";
import apiKey from "./api-key";
import { ApiError } from "./errors/api-error";
import label from "./label";
import mcpRoutes, { mcpWellKnownRoutes } from "./mcp";
import { migrateColumns } from "./migrations/column-migration";
import notification from "./notification";
import notificationPreferences from "./notification-preferences";
import { createRoute, errorResponse, jsonResponse, z } from "./openapi";
import { initializePlugins, integrationPlugins } from "./plugins";
import project from "./project";
import { assertProjectAccess } from "./project-access/assert-project-access";
import { initializeScheduler, shutdownScheduler } from "./scheduler";
import search from "./search";
import { getPrivateObject } from "./storage/s3";
import task from "./task";
import taskRelation from "./task-relation";
import board from "./board";
import taskChangeRequest from "./task-change-request";
import slackDm from "./slack-dm";
import tour from "./tour";
import user from "./user";
import getAvatar from "./user/controllers/get-avatar";
import { applyApiKeyHeaders } from "./utils/apply-api-key-headers";
import { authenticateApiRequest } from "./utils/authenticate-api-request";
import { type AuthMethod, channelFor } from "./utils/request-channel";
import { requireIntegrationProviderEnabled } from "./instance-settings/require-integration-provider-enabled";
import { authorizeAssetAccess } from "./utils/authorize-asset-access";
import { clientIpMiddleware } from "./utils/client-ip";
import { normalizeApiServerUrl } from "./utils/openapi-spec";
import { seedDefaultWorkspaceRoles } from "./utils/seed-default-workspace-roles";
import { validateWorkspaceAccess } from "./utils/validate-workspace-access";
import { requireWorkspacePermission } from "./utils/require-workspace-permission";
import { PROJECT_READ_PERMISSIONS } from "./ws/project-read-permissions";
import workflowRule from "./workflow-rule";
import workspace from "./workspace";
import {
  addConnection,
  addUserConnection,
  initializeWebSocketAdapter,
  removeConnection,
  removeUserConnection,
  shutdownWebSocketAdapter,
} from "./ws";
import {
  assertWebSocketOrigin,
  handleWebSocketMessage,
  MAX_WEBSOCKET_MESSAGE_BYTES,
} from "./ws/security";
import { resolveApiPort } from "./utils/api-port";

type ApiKey = {
  id: string;
  userId: string;
  enabled: boolean;
  permissions: Record<string, string[]> | null;
};

type AppVariables = {
  Variables: {
    identity: Identity | null;
    sessionId: string | null;
    userId: string;
    apiKey?: ApiKey;
  };
};

type ApiVariables = {
  Variables: {
    identity: Identity | null;
    sessionId: string | null;
    userId: string;
    userEmail: string;
    apiKey?: ApiKey;
    apiKeyHeaders?: Record<string, string>;
    workspaceId?: string;
    authMethod?: AuthMethod;
  };
};

const SAFE_INLINE_ASSET_TYPES = new Set([
  "image/apng",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function buildContentDisposition(filename: string, inline: boolean) {
  const normalized = filename
    .normalize("NFC")
    .replace(/[\r\n"]/g, "")
    .trim();
  const safeFilename = normalized || "file";
  const asciiFallback =
    safeFilename
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/]/g, "-")
      .replace(/[^\x20-\x7E]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "file";
  const encodedFilename = encodeURIComponent(safeFilename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  const disposition = inline ? "inline" : "attachment";
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}

export function createApp() {
  const app = new Hono<AppVariables>();
  app.use("*", requestContext());
  app.use("*", clientIpMiddleware());

  app.onError((err) => {
    reportRequestError(err);
    if (err instanceof HTTPException) return httpExceptionResponse(err);
    return httpExceptionResponse(
      new HTTPException(500, { message: "Internal Server Error" }),
    );
  });

  app.notFound((c) => {
    const path = c.req.path;
    if (path === "/api" || path.startsWith("/api/")) {
      return notFoundResponse();
    }
    return c.text("404 Not Found", 404);
  });

  const nodeWs = createNodeWebSocket({ app });
  // node-ws exposes its ws server, but does not accept constructor options.
  // Set the receiver limit before any connection can upgrade, including
  // fragmented messages, before node-ws converts text buffers to strings.
  nodeWs.wss.options.maxPayload = MAX_WEBSOCKET_MESSAGE_BYTES;
  nodeWs.wss.options.perMessageDeflate = false;
  const { upgradeWebSocket, injectWebSocket } = nodeWs;
  const corsOriginSource = [
    process.env.CORS_ORIGINS,
    process.env.BATON_CLIENT_URL,
  ].find((value) => value?.trim());
  const corsOrigins = corsOriginSource
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const reflectUnconfiguredOrigins = process.env.NODE_ENV !== "production";

  if (!corsOrigins && !reflectUnconfiguredOrigins) {
    logger.warn(
      "[cors] Neither CORS_ORIGINS nor BATON_CLIENT_URL is set, so cross-origin requests are refused. Same-origin deployments (the bundled image) are unaffected; set BATON_CLIENT_URL if the web app is served from another origin.",
    );
  }

  app.use(
    "*",
    cors({
      credentials: true,
      exposeHeaders: [
        "Retry-After",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ],
      origin: (origin) => {
        // Reflecting an arbitrary origin alongside credentials lets any site
        // read authenticated responses, so it stays a development convenience.
        if (!corsOrigins) {
          return reflectUnconfiguredOrigins ? origin || "*" : null;
        }

        if (!origin) {
          return null;
        }

        return corsOrigins.includes(origin) ? origin : null;
      },
    }),
  );

  // Large boards return multi-MB JSON (board/task list responses embed
  // labels and external links per task); gzip cuts that by 85-95% since
  // JSON with repeated keys compresses extremely well.
  app.use(compress());

  const api = new OpenAPIHono<ApiVariables>({ defaultHook: validationHook });

  api.use("*", applyApiKeyHeaders);

  const apiKeyRateLimited = api.openAPIRegistry.registerComponent(
    "responses",
    "ApiKeyRateLimited",
    {
      description:
        "The API key exceeded its rate limit or usage quota. Wait the number of seconds in Retry-After before retrying. The X-RateLimit headers are sent only when the rate limit was hit.",
      headers: {
        "Retry-After": {
          description:
            "Seconds to wait before retrying. Omitted when an exhausted usage quota never refills.",
          schema: { type: "integer" },
        },
        "X-RateLimit-Limit": {
          description: "Requests the API key may make per window.",
          schema: { type: "integer" },
        },
        "X-RateLimit-Remaining": {
          description: "Requests left in the current window.",
          schema: { type: "integer" },
        },
        "X-RateLimit-Reset": {
          description: "Unix time in seconds when the current window resets.",
          schema: { type: "integer" },
        },
      },
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ApiError" },
        },
      },
    },
  );

  api.get("/health", (c) => {
    return c.json({ status: "ok" });
  });

  api.openapi(
    createRoute({
      method: "get",
      operationId: "getInstanceStatus",
      path: "/instance/status",
      tags: ["Instance"],
      summary: "Get instance status",
      description:
        "Public instance setup status. When hasUsers is false the next signup becomes the instance admin.",
      security: [],
      responses: {
        200: jsonResponse(
          "Instance status",
          z
            .object({ hasUsers: z.boolean(), hasAdmin: z.boolean() })
            .openapi("InstanceStatus"),
        ),
      },
    }),
    async (c) => c.json(await getInstanceStatus(), 200),
  );

  api.post("/github-integration/webhook", handleGithubWebhookRoute);

  // Public: anyone holding a link may preview it, before signing in.
  const joinLinkPublicApi = api.route("/join-link", joinLinkPublic);

  api.openapi(
    createRoute({
      method: "get",
      operationId: "getSession",
      path: "/auth/get-session",
      tags: ["Authentication"],
      summary: "Get session",
      description:
        "Get the current authenticated session, or null when the caller is not signed in. Served by Better Auth. An API key is refused here, as on every /api/auth path; use GET /api/user/me.",
      security: [],
      responses: {
        200: {
          description: "Current session details, or null when unauthenticated",
        },
        403: errorResponse("Sent with an API key (SESSION_REQUIRED)"),
      },
    }),
    forwardAuthRequest,
  );

  api.openapi(
    createRoute({
      method: "get",
      operationId: "getAsset",
      path: "/asset/{id}",
      tags: ["Assets"],
      summary: "Download asset",
      description:
        "Download an uploaded asset. Image types are served inline, everything else as an attachment.",
      security: [],
      request: { params: z.object({ id: z.string() }) },
      responses: {
        200: {
          description: "The requested asset binary stream",
          content: { "*/*": { schema: { type: "string", format: "binary" } } },
        },
        304: { description: "Not modified" },
        403: errorResponse(
          "Staged upload owned by another user, or no access to the asset's project",
        ),
        404: errorResponse("Asset not found"),
        429: apiKeyRateLimited.ref,
      },
    }),
    async (c) => {
      const { id } = c.req.param();
      const [asset] = await db
        .select({
          id: schema.assetTable.id,
          objectKey: schema.assetTable.objectKey,
          mimeType: schema.assetTable.mimeType,
          filename: schema.assetTable.filename,
          surface: schema.assetTable.surface,
          createdBy: schema.assetTable.createdBy,
          workspaceId: schema.assetTable.workspaceId,
          projectId: schema.assetTable.projectId,
        })
        .from(schema.assetTable)
        .innerJoin(
          schema.projectTable,
          eq(schema.assetTable.projectId, schema.projectTable.id),
        )
        .where(eq(schema.assetTable.id, id))
        .limit(1);

      if (!asset) {
        throw new HTTPException(404, { message: "Asset not found" });
      }

      await authorizeAssetAccess(c, asset);

      try {
        const object = await getPrivateObject(asset.objectKey);
        const storedContentType =
          (object.contentType || asset.mimeType)
            .toLowerCase()
            .split(";")[0]
            ?.trim() ?? "";
        const inline = SAFE_INLINE_ASSET_TYPES.has(storedContentType);

        return new Response(object.body as BodyInit, {
          headers: {
            "Cache-Control": "private, max-age=120",
            "Content-Disposition": buildContentDisposition(
              asset.filename,
              inline,
            ),
            "Content-Length": object.contentLength?.toString() || "",
            "Content-Type": inline
              ? storedContentType
              : "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
            ETag: object.etag || "",
            "Last-Modified": object.lastModified?.toUTCString() || "",
          },
        });
      } catch (error) {
        logger.error("Failed to stream asset", { error });
        throw new HTTPException(404, { message: "Asset object not found" });
      }
    },
  );

  api.openapi(
    createRoute({
      method: "get",
      operationId: "getUserAvatar",
      path: "/user/avatar/{id}",
      tags: ["User"],
      summary: "Download avatar",
      description:
        "Download a user avatar by its avatar ID. Public, immutable, and cache-friendly: the id changes whenever the avatar is replaced.",
      security: [],
      request: { params: z.object({ id: z.string() }) },
      responses: {
        200: {
          description: "The avatar image",
          content: {
            "image/*": { schema: { type: "string", format: "binary" } },
          },
        },
        304: { description: "Not modified" },
        404: errorResponse("Avatar not found"),
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const avatar = await getAvatar(id);

      if (!avatar) {
        throw new HTTPException(404, { message: "Avatar not found" });
      }

      const etag = `"${avatar.id}"`;
      if (c.req.header("If-None-Match") === etag) {
        return new Response(null, { status: 304, headers: { ETag: etag } });
      }

      return new Response(new Uint8Array(avatar.data) as BodyInit, {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": avatar.size.toString(),
          "Content-Type": avatar.mimeType,
          "X-Content-Type-Options": "nosniff",
          ETag: etag,
          "Last-Modified": avatar.updatedAt.toUTCString(),
        },
      });
    },
  );

  const configApi = api.route("/config", config);

  api.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    description: "API key or session token (Bearer)",
  });
  api.openAPIRegistry.register("ApiError", apiErrorSchema);

  api.get("/openapi", (c) => {
    const document = api.getOpenAPI31Document({
      openapi: "3.1.0",
      info: {
        title: "Baton API",
        version: "1.0.0",
        description:
          "Baton Project Management API - Manage projects, tasks, labels, and more",
      },
      servers: [
        {
          url: normalizeApiServerUrl(
            process.env.BATON_API_URL || "http://localhost:1337",
          ),
          description: "Baton API Server",
        },
      ],
      security: [{ bearerAuth: [] }],
    });

    // Every authenticated route sits behind the same app-wide
    // authenticateApiRequest middleware, so the shared 401 and 429 are injected
    // here rather than repeated on all ~120 route definitions. Routes that opt
    // out of auth declare `security: []` and are skipped.
    const httpMethods = [
      "get",
      "post",
      "put",
      "delete",
      "patch",
      "options",
      "head",
      "trace",
    ];
    const paths = (document.paths ?? {}) as Record<
      string,
      Record<
        string,
        { responses?: Record<string, unknown>; security?: unknown[] }
      >
    >;
    for (const operations of Object.values(paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        if (!httpMethods.includes(method) || !operation.responses) continue;
        if (
          Array.isArray(operation.security) &&
          operation.security.length === 0
        ) {
          continue;
        }
        operation.responses["401"] ??= {
          description: "Missing or invalid credentials",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        };
        operation.responses["429"] ??= apiKeyRateLimited.ref;
      }
    }

    return c.json(document);
  });

  // Baton owns workspaces now (auth-boundary P3): the provider's
  // organization routes are gone, for every kind of credential.
  api.all("/auth/organization/*", () => {
    throw new ApiError(404, {
      code: "NOT_FOUND",
      message: "Workspaces are served under /api/workspace.",
    });
  });

  api.on(
    ["POST", "GET", "PUT", "PATCH", "DELETE"],
    "/auth/*",
    forwardAuthRequest,
  );

  api.route("/", mcpRoutes);

  api.use("*", async (c, next) => {
    const path = c.req.path;
    if (path.startsWith("/api/mcp") || path.startsWith("/api/.well-known/")) {
      return next();
    }
    // requestContext() already gave this request its own Sentry scope.
    try {
      await authenticateApiRequest(c);
    } catch (error) {
      if (!(error instanceof HTTPException)) {
        logger.error("API authentication failed", { error });
        throw new HTTPException(500, { message: "Internal Server Error" });
      }
      throw error;
    }
    const windowId = c.req.header("X-Baton-Window-Id");
    const userId = c.get("userId");
    const initiatorId = windowId ? `${userId}:${windowId}` : userId;
    return eventContext.run(
      { initiatorId, channel: channelFor(c.get("authMethod")) },
      next,
    );
  });

  const projectApi = api.route("/project", project);
  const taskApi = api.route("/task", task);
  const columnApi = api.route("/column", column);
  const activityApi = api.route("/activity", activity);
  const commentApi = api.route("/comment", comment);
  const labelApi = api.route("/label", label);
  const notificationApi = api.route("/notification", notification);
  const notificationPreferencesApi = api.route(
    "/notification-preferences",
    notificationPreferences,
  );
  const searchApi = api.route("/search", search);
  // Turned-off providers: registered before their routes so they run first.
  // Inbound provider webhooks are mounted earlier and answer on their own;
  // their work is skipped through `activeIntegrationCondition`.
  for (const { type } of integrationPlugins) {
    api.use(`/${type}-integration/*`, requireIntegrationProviderEnabled(type));
  }
  // Saving sync rules and resuming paused links write through the provider.
  const syncProvider = requireIntegrationProviderEnabled((c) =>
    c.req.param("provider"),
  );
  api.use("/integration-sync/project/:projectId/:provider", syncProvider);
  api.use("/integration-sync/project/:projectId/:provider/*", syncProvider);
  const integrationSyncApi = api.route("/integration-sync", integrationSync);
  const githubIntegrationApi = api.route(
    "/github-integration",
    githubIntegration,
  );
  const taskRelationApi = api.route("/task-relation", taskRelation);
  const boardApi = api.route("/board", board);
  const taskChangeRequestApi = api.route(
    "/task-change-request",
    taskChangeRequest,
  );
  const slackDmApi = api.route("/slack-dm", slackDm);
  const tourApi = api.route("/tour", tour);
  const externalLinkApi = api.route("/external-link", externalLink);
  const workflowRuleApi = api.route("/workflow-rule", workflowRule);
  const joinLinkApi = api.route("/join-link", joinLink);
  const apiKeyApi = api.route("/api-key", apiKey);
  const workspaceApi = api.route("/workspace", workspace);
  const userApi = api.route("/user", user);
  const adminApi = api.route("/admin", admin);

  app.route(
    "/",
    mcpWellKnownRoutes(
      (process.env.BATON_API_URL || "http://localhost:1337").replace(
        /\/api\/?$/,
        "",
      ),
    ),
  );

  // User-scoped WebSocket endpoint; MUST be registered before /ws/:projectId
  // so the literal path "user" isn't consumed by the param route.
  api.get(
    "/ws/user",
    upgradeWebSocket(async (c) => {
      assertWebSocketOrigin(c.req.raw.headers);

      const userId = c.get("userId");
      const sessionId = c.get("sessionId") ?? null;
      const apiKeyId = c.get("apiKey")?.id;
      let conn: ReturnType<typeof addUserConnection> | null = null;

      return {
        onOpen(_evt, ws) {
          if (userId) {
            conn = addUserConnection(userId, ws, sessionId, apiKeyId);
            void syncWorkspaceAccess(userId, ws);
          }
        },
        onMessage: handleWebSocketMessage,
        onClose() {
          if (conn && userId) {
            removeUserConnection(userId, conn);
          }
        },
      };
    }),
  );

  api.get(
    "/ws/:projectId",
    upgradeWebSocket(async (c) => {
      assertWebSocketOrigin(c.req.raw.headers);
      const projectId = c.req.param("projectId");

      const userId = c.get("userId");

      let workspaceId: string | undefined;
      if (projectId) {
        const [project] = await db
          .select({ workspaceId: schema.projectTable.workspaceId })
          .from(schema.projectTable)
          .where(eq(schema.projectTable.id, projectId))
          .limit(1);

        if (!project) {
          throw new HTTPException(404, { message: "Project not found" });
        }

        await validateWorkspaceAccess(userId, project.workspaceId, undefined, {
          notFoundMessage: "Project not found",
        });
        await assertProjectAccess(userId, projectId);
        workspaceId = project.workspaceId;
        setWorkspaceContext(c, workspaceId);
        await requireWorkspacePermission(PROJECT_READ_PERMISSIONS)(
          c,
          async () => {},
        );
      }

      const windowId = c.req.query("windowId");
      const initiatorId = windowId ? `${userId}:${windowId}` : userId;
      const sessionId = c.get("sessionId") ?? null;
      let conn: ReturnType<typeof addConnection> | null = null;

      return {
        onOpen(_evt, ws) {
          if (projectId && workspaceId) {
            conn = addConnection(
              projectId,
              ws,
              userId,
              initiatorId,
              workspaceId,
              c.get("apiKey")?.id,
              sessionId,
            );
          }
        },
        onMessage: handleWebSocketMessage,
        onClose() {
          if (conn && projectId) {
            removeConnection(projectId, conn);
          }
        },
      };
    }),
  );

  app.route("/api", api);

  return {
    app,
    api,
    injectWebSocket,
    activityApi,
    columnApi,
    commentApi,
    configApi,
    externalLinkApi,
    integrationSyncApi,
    githubIntegrationApi,
    joinLinkApi,
    apiKeyApi,
    joinLinkPublicApi,
    labelApi,
    notificationApi,
    notificationPreferencesApi,
    projectApi,
    searchApi,
    taskApi,
    taskRelationApi,
    boardApi,
    taskChangeRequestApi,
    slackDmApi,
    tourApi,
    userApi,
    adminApi,
    workflowRuleApi,
    workspaceApi,
  };
}

export async function runStartupTasks() {
  const currentDir = dirname(fileURLToPath(import.meta.url));

  await prepareDatabaseStartup({
    waitForDatabase: async () => {
      await waitForDatabase({
        query: async () => {
          await getDatabase().execute(sql`SELECT 1`);
        },
      });
    },
    runStartupMigrations: async () => {
      logger.info("🔄 Migrating database...");
      await migrate(getDatabase(), {
        migrationsFolder: `${currentDir}/../drizzle`,
      });
      logger.info("✅ Database migrated successfully!");
    },
  });

  await migrateColumns();
  await seedDefaultWorkspaceRoles();

  initializePlugins();
  initializeScheduler();
  await initializeWebSocketAdapter();
}

export async function startServer(
  injectWebSocket: ReturnType<typeof createNodeWebSocket>["injectWebSocket"],
  port = resolveApiPort(process.env.BATON_API_PORT),
) {
  try {
    await runStartupTasks();
  } catch (error) {
    logger.error("❌ Database migration failed!", { error });
    process.exit(1);
  }

  let shuttingDown = false;

  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    () => {
      logger.info(
        `⚡ API is running at ${process.env.BATON_API_URL || "http://localhost:1337"}`,
      );
    },
  );

  injectWebSocket(server);
  const stopWebhookWorker = startWebhookWorker();
  const stopOutboxRelay = startOutboxRelay();

  const gracefulShutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info("🛑 Shutting down gracefully...");
    shutdownScheduler();
    await stopWebhookWorker();
    // Waits for in-flight deliveries; unfinished rows run after their lease.
    await stopOutboxRelay();
    await shutdownWebSocketAdapter();
    server.close();
    await drainPasswordResetDeliveries();
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void gracefulShutdown();
  });

  process.on("SIGINT", () => {
    void gracefulShutdown();
  });
}

const createdApp = createApp();
const {
  app,
  injectWebSocket,
  activityApi,
  columnApi,
  commentApi,
  configApi,
  externalLinkApi,
  integrationSyncApi,
  githubIntegrationApi,
  joinLinkApi,
  apiKeyApi,
  joinLinkPublicApi,
  labelApi,
  notificationApi,
  notificationPreferencesApi,
  projectApi,
  searchApi,
  taskApi,
  taskRelationApi,
  boardApi,
  taskChangeRequestApi,
  slackDmApi,
  tourApi,
  userApi,
  adminApi,
  workflowRuleApi,
  workspaceApi,
} = createdApp;

const entrypoint = process.argv[1];
const isMainModule =
  entrypoint !== undefined &&
  entrypoint !== "" &&
  import.meta.url === pathToFileURL(entrypoint).href;

if (isMainModule) {
  void startServer(injectWebSocket);
}

export type AppType =
  | typeof configApi
  | typeof projectApi
  | typeof taskApi
  | typeof columnApi
  | typeof activityApi
  | typeof commentApi
  | typeof labelApi
  | typeof notificationApi
  | typeof notificationPreferencesApi
  | typeof searchApi
  | typeof integrationSyncApi
  | typeof githubIntegrationApi
  | typeof taskRelationApi
  | typeof boardApi
  | typeof taskChangeRequestApi
  | typeof slackDmApi
  | typeof tourApi
  | typeof externalLinkApi
  | typeof workflowRuleApi
  | typeof joinLinkApi
  | typeof apiKeyApi
  | typeof joinLinkPublicApi
  | typeof workspaceApi
  | typeof userApi
  | typeof adminApi;

export default app;
