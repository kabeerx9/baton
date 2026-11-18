import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { readClientIp } from "../utils/client-ip";
import previewJoinLink from "./controllers/preview-join-link";
import { rateLimited } from "./errors";
import { previewLimiter } from "./rate-limit";
import { joinLinkPreviewSchema, previewJoinLinkBody } from "./schema";

const previewRoute = createRoute({
  method: "post",
  operationId: "previewJoinLink",
  path: "/preview",
  tags: ["Join links"],
  summary: "Preview a join link",
  description:
    "Public. Says whether a join link works and, only while it does, the workspace name, the sharer's name and the expiry. A malformed, unknown, archived or demo link reads as not_found. The token travels in the body, so request logs do not hold it.",
  security: [],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: previewJoinLinkBody } },
    },
  },
  responses: {
    200: jsonResponse("What the link leads to", joinLinkPreviewSchema),
    400: errorResponse("Invalid request"),
    429: errorResponse(
      "Too many previews from this address; wait Retry-After seconds",
    ),
  },
});

// Mounted before the auth middleware: anyone with a link can preview it.
const joinLinkPublic = apiRouter<BaseVariables>().openapi(
  previewRoute,
  async (c) => {
    const { token } = c.req.valid("json");
    const decision = previewLimiter.hit(
      readClientIp(c.req.raw.headers) ?? "unknown",
    );
    if (decision.kind === "limited")
      throw rateLimited(
        "Too many join link previews. Try again later.",
        decision.retryAfterSeconds,
      );
    c.header("Cache-Control", "no-store");
    return c.json(await previewJoinLink(token), 200);
  },
);

export default joinLinkPublic;
