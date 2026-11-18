import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import createApiKey from "./controllers/create-api-key";
import deleteApiKey from "./controllers/delete-api-key";
import listApiKeys from "./controllers/list-api-keys";
import {
  apiKeyListSchema,
  createdApiKeySchema,
  deletedApiKeySchema,
} from "./response";
import { apiKeyIdParam, createApiKeyBody } from "./schema";

// Keys are managed by a person: an API key or an MCP token cannot list,
// create or delete them.
const sessionErrors = {
  401: errorResponse("Unauthorized"),
  403: errorResponse(
    "Authenticated with an API key or agent token (SESSION_REQUIRED)",
  ),
};

const listRoute = createRoute({
  method: "get",
  operationId: "listApiKeys",
  path: "/",
  tags: ["API keys"],
  summary: "List your API keys",
  description:
    "The caller's API keys, newest first. Never includes the secret or its hash. Requires a user session.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("The caller's keys", apiKeyListSchema),
    ...sessionErrors,
  },
});

const createKeyRoute = createRoute({
  method: "post",
  operationId: "createApiKey",
  path: "/",
  tags: ["API keys"],
  summary: "Create an API key",
  description:
    "Makes a key that acts as the caller, limited to 100 requests a minute. The response is the only time the secret is shown. Requires a user session.",
  middleware: [requireUserSession] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createApiKeyBody } },
    },
  },
  responses: {
    201: jsonResponse("The new key and its secret", createdApiKeySchema),
    400: errorResponse("Invalid request"),
    ...sessionErrors,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteApiKey",
  path: "/{id}",
  tags: ["API keys"],
  summary: "Delete an API key",
  description:
    "Deletes one of the caller's keys. Requests with it fail at once and its WebSocket connections close. Requires a user session.",
  middleware: [requireUserSession] as const,
  request: { params: apiKeyIdParam },
  responses: {
    200: jsonResponse("The key is deleted", deletedApiKeySchema),
    ...sessionErrors,
    404: errorResponse("No such key among the caller's keys"),
  },
});

const apiKey = apiRouter()
  .openapi(listRoute, async (c) =>
    c.json(await listApiKeys(c.get("userId")), 200),
  )
  .openapi(createKeyRoute, async (c) =>
    c.json(await createApiKey(c.get("userId"), c.req.valid("json")), 201),
  )
  .openapi(deleteRoute, async (c) =>
    c.json(await deleteApiKey(c.get("userId"), c.req.valid("param").id), 200),
  );

export default apiKey;
