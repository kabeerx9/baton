import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { refuseDemoWorkspace } from "../workspace/kind/refuse-demo-workspace";
import createJoinLink from "./controllers/create-join-link";
import getJoinLink from "./controllers/get-join-link";
import joinWorkspace from "./controllers/join-workspace";
import revokeJoinLink from "./controllers/revoke-join-link";
import { rateLimited } from "./errors";
import { joinLimiter } from "./rate-limit";
import {
  createdJoinLinkResponse,
  createJoinLinkBody,
  joinLinkResponse,
  joinWorkspaceBody,
  joinWorkspaceResponse,
  revokedJoinLinkResponse,
  workspaceIdParam,
} from "./schema";

// A link is a tenant-boundary credential and consent to join belongs to a
// person: every route here refuses API keys and MCP tokens.
const manageLink = [
  workspaceAccess.fromParam("workspaceId"),
  refuseDemoWorkspace,
  requireUserSession,
  requireWorkspacePermission({ join_link: ["create"] }),
];

const manageErrors = {
  403: errorResponse(
    "A user session is required (SESSION_REQUIRED), the caller lacks join_link:create (MISSING_PERMISSION), the workspace is a demo (DEMO_WORKSPACE) or archived (WORKSPACE_ARCHIVED)",
  ),
  404: errorResponse("Workspace not found"),
};

const getRoute = createRoute({
  method: "get",
  operationId: "getJoinLink",
  path: "/workspace/{workspaceId}",
  tags: ["Join links"],
  summary: "Get the workspace's join link",
  description:
    "The workspace's one link that is not revoked, in any state, or null. `url` is set only while the link is active and the server can read it again.",
  middleware: manageLink,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("The current link, or null", joinLinkResponse),
    ...manageErrors,
  },
});

const createLinkRoute = createRoute({
  method: "post",
  operationId: "createJoinLink",
  path: "/workspace/{workspaceId}",
  tags: ["Join links"],
  summary: "Create a join link",
  description:
    "Makes a new link that adds people as members, and turns off the previous one in the same transaction. The response always carries `url`. At most 20 links per workspace per hour.",
  middleware: manageLink,
  request: {
    params: workspaceIdParam,
    body: {
      required: false,
      content: { "application/json": { schema: createJoinLinkBody } },
    },
  },
  responses: {
    201: jsonResponse("The new link", createdJoinLinkResponse),
    400: errorResponse("Invalid request"),
    ...manageErrors,
    429: errorResponse(
      "More than 20 links this hour (RATE_LIMITED); wait Retry-After seconds",
    ),
  },
});

const revokeRoute = createRoute({
  method: "delete",
  operationId: "revokeJoinLink",
  path: "/workspace/{workspaceId}",
  tags: ["Join links"],
  summary: "Turn off the join link",
  description: "Revokes the workspace's link. Idempotent.",
  middleware: manageLink,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("No link is active now", revokedJoinLinkResponse),
    ...manageErrors,
  },
});

const joinRoute = createRoute({
  method: "post",
  operationId: "joinWorkspace",
  path: "/join",
  tags: ["Join links"],
  summary: "Join a workspace with a link",
  description:
    "Adds the signed-in person to the link's workspace as a member. A person who is already a member gets `already_member` and uses nothing. A link made before the person was removed from the workspace refuses them.",
  middleware: [requireUserSession] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: joinWorkspaceBody } },
    },
  },
  responses: {
    200: jsonResponse("Joined, or already a member", joinWorkspaceResponse),
    400: errorResponse("Invalid request"),
    403: errorResponse(
      "A user session is required (SESSION_REQUIRED), or the caller was removed after the link was made (REMOVED_FROM_WORKSPACE)",
    ),
    404: errorResponse(
      "Unknown or malformed link, or the workspace is archived, a demo or gone (JOIN_LINK_NOT_FOUND)",
    ),
    409: errorResponse(
      "The workspace has 100 members (WORKSPACE_MEMBER_LIMIT_REACHED)",
    ),
    410: errorResponse(
      "The link expired (JOIN_LINK_EXPIRED), was revoked (JOIN_LINK_REVOKED) or is used up (JOIN_LINK_USED_UP)",
    ),
    429: errorResponse("Too many attempts (RATE_LIMITED); wait Retry-After"),
  },
});

const joinLink = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await getJoinLink(workspaceId), 200);
  })
  .openapi(createLinkRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const body = c.req.valid("json") ?? { expiresIn: "24h" as const };
    const result = await createJoinLink({
      workspaceId,
      userId: c.get("userId"),
      expiresIn: body.expiresIn ?? "24h",
      maxUses: body.maxUses ?? null,
    });
    return c.json(result, 201);
  })
  .openapi(revokeRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await revokeJoinLink(workspaceId, c.get("userId")), 200);
  })
  .openapi(joinRoute, async (c) => {
    const { token } = c.req.valid("json");
    const userId = c.get("userId");
    const decision = joinLimiter.hit(userId);
    if (decision.kind === "limited")
      throw rateLimited(
        "Too many join attempts. Try again later.",
        decision.retryAfterSeconds,
      );
    return c.json(await joinWorkspace(token, userId), 200);
  });

export default joinLink;
