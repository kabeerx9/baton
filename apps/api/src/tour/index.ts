import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import finishTour from "./controllers/finish-tour";
import getTour from "./controllers/get-tour";
import replayTour from "./controllers/replay-tour";
import startTour from "./controllers/start-tour";
import {
  tourFinishBody,
  tourFinishSchema,
  tourReplaySchema,
  tourStartSchema,
  tourStatusSchema,
} from "./schema";

const getTourRoute = createRoute({
  method: "get",
  operationId: "getTour",
  path: "/",
  tags: ["Tour"],
  summary: "Get my tour state",
  description:
    "Whether the caller completed the product tour, and their demo workspace if one exists.",
  responses: { 200: jsonResponse("The caller's tour state", tourStatusSchema) },
});

const startTourRoute = createRoute({
  method: "post",
  operationId: "startTour",
  path: "/start",
  tags: ["Tour"],
  summary: "Start the tour",
  description:
    "Idempotent while the tour runs: returns the caller's existing demo workspace, so a reload or a second tab continues the same tour. Seeds one with five demo tasks when none exists, and replaces a demo that lost one of its tour tasks. A user has at most one demo workspace. A demo workspace sends nothing outside Baton: no Slack, email, push, webhook or integration.",
  // A reset deletes data: only the person, never an API key or agent.
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("The demo workspace and its tasks", tourStartSchema),
    403: errorResponse(
      "A user session is required; API keys and agents cannot",
    ),
    409: errorResponse(
      "The tour is already completed. Call replay before starting it again.",
    ),
  },
});

const finishTourRoute = createRoute({
  method: "post",
  operationId: "finishTour",
  path: "/finish",
  tags: ["Tour"],
  summary: "Finish or skip the tour",
  description:
    "Records the tour as completed and deletes the caller's demo workspace. Idempotent: a repeat keeps the first completion time.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: tourFinishBody } },
    },
  },
  // A reset deletes data: only the person, never an API key or agent.
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("The tour is completed", tourFinishSchema),
    400: errorResponse("Invalid request"),
    403: errorResponse(
      "A user session is required; API keys and agents cannot",
    ),
  },
});

const replayTourRoute = createRoute({
  method: "post",
  operationId: "replayTour",
  path: "/replay",
  tags: ["Tour"],
  summary: "Replay the tour",
  description:
    "Clears the caller's completion so the tour can start again. Call start next.",
  // A reset deletes data: only the person, never an API key or agent.
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("The tour is open again", tourReplaySchema),
    403: errorResponse(
      "A user session is required; API keys and agents cannot",
    ),
  },
});

const tour = apiRouter<BaseVariables>()
  .openapi(getTourRoute, async (c) =>
    c.json(await getTour(c.get("userId")), 200),
  )
  .openapi(startTourRoute, async (c) =>
    c.json(await startTour(c.get("userId")), 200),
  )
  .openapi(finishTourRoute, async (c) => {
    // Finishing and skipping end the tour the same way; the outcome is
    // validated so clients send a meaningful value.
    c.req.valid("json");
    return c.json(await finishTour(c.get("userId")), 200);
  })
  .openapi(replayTourRoute, async (c) =>
    c.json(await replayTour(c.get("userId")), 200),
  );

export default tour;
