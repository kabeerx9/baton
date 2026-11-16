import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  isJsonContentType,
  isLegacyRequest,
} from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { apiRouter, createRoute, jsonResponse, z } from "../openapi";
import { authenticateMcpRequest } from "./authenticate-mcp-request";
import {
  beginMcpAuthorization,
  decideMcpAuthorizationRequest,
  getMcpAuthorizationRequest,
  registerMcpClient,
} from "./controllers/oauth-consent";
import { mcpGrantRoutes } from "./grants/routes";
import { handleTokenRequest } from "./handle-token-request";
import { createModernMcpHandler } from "./modern";
import {
  MCP_BODY_BYTES,
  mcpRequestBounds,
  oauthRequestBounds,
} from "./request-bounds";
import {
  authorizationDecisionResponseSchema,
  authorizationDecisionSchema,
  authorizationQuerySchema,
  authorizationRequestParamSchema,
  authorizationRequestResponseSchema,
  clientRegistrationResponseSchema,
  clientRegistrationSchema,
  oauthErrorSchema,
} from "./schemas";
import { createMcpServerForUser } from "./legacy-server";
import type { McpToolOptions } from "./tools";
import {
  authorizationServerMetadata,
  internalApiUrl,
  protectedResourceMetadata,
  publicApiUrl,
} from "./urls";

const mcp = apiRouter();
for (const path of [
  "/mcp/register",
  "/mcp/authorize",
  "/mcp/authorize/request/*",
  "/mcp/token",
]) {
  mcp.use(path, oauthRequestBounds);
}

const jsonError = (description: string) =>
  jsonResponse(description, oauthErrorSchema);

// OAuth clients parse validation failures, so these routes answer with the
// RFC 6749 / RFC 7591 JSON error shape instead of the router's text default.
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const oauthValidationHook =
  (error: "invalid_request" | "invalid_client_metadata") =>
  (result: ValidationResult): undefined => {
    if (result.success) return;
    const issue = result.error?.issues[0] as
      | { path?: PropertyKey[]; message?: string }
      | undefined;
    const field = issue?.path?.map(String).join(".");
    throw new HTTPException(400, {
      res: Response.json(
        {
          error: field?.startsWith("redirect_uri")
            ? "invalid_redirect_uri"
            : error,
          error_description: issue
            ? `${field || "request"}: ${issue.message}`
            : "Invalid request",
        },
        { status: 400 },
      ),
    });
  };

const registerRoute = createRoute({
  method: "post",
  operationId: "registerMcpOAuthClient",
  path: "/mcp/register",
  tags: ["MCP"],
  summary: "Register MCP OAuth client",
  description:
    "Dynamically register a public OAuth client for the MCP endpoint. Public clients hold no secret, so authorization is protected by PKCE and an explicit consent step.",
  security: [],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: clientRegistrationSchema } },
    },
  },
  responses: {
    200: jsonResponse(
      "Registered OAuth client",
      clientRegistrationResponseSchema,
    ),
    400: jsonError("Invalid client metadata"),
  },
});

const authorizeRoute = createRoute({
  method: "get",
  operationId: "authorizeMcpOAuthClient",
  path: "/mcp/authorize",
  tags: ["MCP"],
  summary: "Start MCP authorization",
  description:
    "Begin an MCP OAuth authorization. Redirects the browser to the Baton consent page, which then approves or denies the request. A redirect URI on http loopback matches its registration on any port (RFC 8252). A resource other than this server's /api/mcp endpoint is sent back to the client as error=invalid_target. Every redirect back to the client carries iss (RFC 9207).",
  security: [],
  request: { query: authorizationQuerySchema },
  responses: {
    302: {
      description:
        "Redirect to the Baton consent page, or back to the client with error=invalid_target",
    },
    400: {
      description:
        "Invalid authorization request (JSON OAuth error). An unknown client_id gets an HTML page that tells the person how to reconnect their agent.",
      content: {
        "application/json": { schema: oauthErrorSchema },
        "text/html": { schema: z.string() },
      },
    },
  },
});

const getAuthorizationRequestRoute = createRoute({
  method: "get",
  operationId: "getMcpAuthorizationRequest",
  path: "/mcp/authorize/request/{requestId}",
  tags: ["MCP"],
  summary: "Get consent request",
  description:
    "Get the client name and redirect URI for a pending consent request, so the consent page can show who is asking.",
  security: [],
  request: { params: authorizationRequestParamSchema },
  responses: {
    200: jsonResponse(
      "Authorization request details",
      authorizationRequestResponseSchema,
    ),
    400: jsonError("Invalid OAuth client"),
    404: jsonError("Unknown or expired authorization request"),
  },
});

const decideAuthorizationRequestRoute = createRoute({
  method: "post",
  operationId: "decideMcpAuthorizationRequest",
  path: "/mcp/authorize/request/{requestId}",
  tags: ["MCP"],
  summary: "Decide consent request",
  description:
    "Approve or deny a pending consent request and get the URL to send the browser back to.",
  request: {
    params: authorizationRequestParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: authorizationDecisionSchema } },
    },
  },
  responses: {
    200: jsonResponse(
      "OAuth client redirect",
      authorizationDecisionResponseSchema,
    ),
    400: jsonError("Invalid request or OAuth client"),
    401: jsonError("Authentication required"),
    403: jsonError("Untrusted request origin"),
    404: jsonError("Unknown or expired authorization request"),
  },
});

mcp
  .openapi(
    registerRoute,
    async (c) => c.json(await registerMcpClient(c.req.valid("json")), 200),
    oauthValidationHook("invalid_client_metadata"),
  )
  .openapi(
    authorizeRoute,
    async (c) => c.redirect(await beginMcpAuthorization(c.req.valid("query"))),
    oauthValidationHook("invalid_request"),
  )
  .openapi(
    getAuthorizationRequestRoute,
    async (c) =>
      c.json(
        await getMcpAuthorizationRequest(c.req.valid("param").requestId),
        200,
      ),
    oauthValidationHook("invalid_request"),
  )
  .openapi(
    decideAuthorizationRequestRoute,
    async (c) => {
      const redirect = await decideMcpAuthorizationRequest({
        requestId: c.req.valid("param").requestId,
        decision: c.req.valid("json"),
        headers: c.req.raw.headers,
        origin: c.req.header("origin"),
      });
      return c.json({ redirect }, 200);
    },
    oauthValidationHook("invalid_request"),
  );

mcp.post("/mcp/token", handleTokenRequest);
mcp.route("/", mcpGrantRoutes);

mcp.get("/.well-known/oauth-protected-resource/api/mcp", (c) =>
  c.json(protectedResourceMetadata()),
);

mcp.get("/.well-known/oauth-authorization-server/api", (c) =>
  c.json(authorizationServerMetadata()),
);

mcp.all("/mcp", async (c) => {
  const principal = await authenticateMcpRequest(c.req.raw);
  if (!principal) {
    // Canonical RFC 9728 URL: the well-known path goes before the resource
    // path. MCP clients discover from this header, so it must be the URL
    // auditors accept; the /api/.well-known alias below stays for clients
    // that cached the previously advertised URL.
    const prmUrl = `${publicApiUrl}/.well-known/oauth-protected-resource/api/mcp`;
    c.header("WWW-Authenticate", `Bearer resource_metadata="${prmUrl}"`);
    return c.json(
      {
        error: "invalid_token",
        error_description: "Missing or invalid token",
      },
      401,
    );
  }

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  if (!isJsonContentType(c.req.header("content-type"))) {
    return c.json({ error: "Unsupported Media Type" }, 415);
  }

  await mcpRequestBounds(c, async () => {});

  const options: McpToolOptions = {
    catalog: c.req.query("tools") === "all" ? "all" : "core",
    defaultWorkspaceId:
      principal.kind === "grant" ? principal.defaultWorkspaceId : null,
  };

  if (
    !(await isLegacyRequest(c.req.raw.clone(), undefined, {
      maxRequestBodySize: MCP_BODY_BYTES,
    }))
  ) {
    const modern = createModernMcpHandler(
      principal.token,
      internalApiUrl,
      options,
    );
    return modern.fetch(c.req.raw);
  }

  // A fresh stateless transport lets legacy POSTs reach any replica. It also
  // accepts session IDs issued before this change after their owner is gone.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    maxRequestBodySize: MCP_BODY_BYTES,
  });
  const server = createMcpServerForUser(
    principal.token,
    internalApiUrl,
    options,
  );
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

export default mcp;

export function mcpWellKnownRoutes(baseUrl: string) {
  const wellKnown = new Hono();

  wellKnown.get("/.well-known/oauth-protected-resource/api/mcp", (c) =>
    c.json(protectedResourceMetadata(baseUrl)),
  );

  wellKnown.get("/.well-known/oauth-authorization-server/api", (c) =>
    c.json(authorizationServerMetadata(baseUrl)),
  );

  return wellKnown;
}
