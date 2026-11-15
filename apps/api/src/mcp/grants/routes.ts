import type { MiddlewareHandler } from "hono";
import { ApiError } from "../../errors/api-error";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../../openapi";
import { authenticateApiRequest } from "../../utils/authenticate-api-request";
import { requireUserSession } from "../../utils/require-user-session";
import { listUserGrants } from "../grant/list-grants";
import { revokeOwnGrant } from "../grant/revoke-grants";
import { mcpGrantListSchema, mcpGrantParamSchema } from "./schemas";

// /api/mcp/* skips the app-wide auth middleware, so these routes sign in here.
// Managing agents is account security: a browser session is required.
const requireSignedInUser: MiddlewareHandler = async (c, next) => {
  await authenticateApiRequest(c);
  return requireUserSession(c, next);
};

const listGrantsRoute = createRoute({
  method: "get",
  operationId: "listMcpGrants",
  path: "/mcp/grants",
  tags: ["MCP"],
  summary: "List connected agents",
  description:
    "List the caller's live MCP grants: one per agent that signed in through OAuth and was not revoked or left unused for 90 days. Tokens are never returned. Requires a user session; API keys and MCP tokens are rejected.",
  middleware: [requireSignedInUser] as const,
  responses: {
    200: jsonResponse(
      "Connected agents, most recently used first",
      mcpGrantListSchema,
    ),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Not a user session"),
  },
});

const revokeGrantRoute = createRoute({
  method: "delete",
  operationId: "revokeMcpGrant",
  path: "/mcp/grants/{id}",
  tags: ["MCP"],
  summary: "Disconnect an agent",
  description:
    "Revoke one of the caller's MCP grants. Its access and refresh tokens stop working on the next call on every API instance. Requires a user session.",
  middleware: [requireSignedInUser] as const,
  request: { params: mcpGrantParamSchema },
  responses: {
    204: { description: "Grant revoked" },
    401: errorResponse("Unauthorized"),
    403: errorResponse("Not a user session"),
    404: errorResponse("No live grant with this id belongs to the caller"),
  },
});

export const mcpGrantRoutes = apiRouter()
  .openapi(listGrantsRoute, async (c) =>
    c.json(await listUserGrants(c.get("userId")), 200),
  )
  .openapi(revokeGrantRoute, async (c) => {
    if (!(await revokeOwnGrant(c.get("userId"), c.req.valid("param").id))) {
      throw new ApiError(404, {
        message: "Grant not found",
        code: "MCP_GRANT_NOT_FOUND",
      });
    }
    return c.body(null, 204);
  });
