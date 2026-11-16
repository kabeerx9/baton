import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { readRequest, readTask } from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { connectMcpAgent } from "./helpers/mcp-oauth";
import { createProjectFixture } from "./helpers/fixtures";

// Drives the HTTP MCP endpoint end to end. The tools call the API over
// fetch; the stub routes those calls back into the same app.

const protocolVersion = "2026-07-28";
type App = ReturnType<typeof createApp>["app"];

beforeEach(resetTestDatabase);
afterEach(() => vi.unstubAllGlobals());

async function signUp(app: App, name: string) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      name,
      email: `${randomUUID()}@example.com`,
      password: "change-request-mcp-password",
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { token: string; user: { id: string } };
}

async function callTool(
  app: App,
  token: string,
  name: string,
  args: Record<string, unknown>,
) {
  const response = await app.request("/api/mcp?tools=all", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "mcp-method": "tools/call",
      "mcp-name": name,
      "mcp-protocol-version": protocolVersion,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name,
        arguments: args,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": {
            name: "baton-change-request-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  expect(response.status).toBe(200);
  const text = await response.text();
  const data =
    text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6) ?? text;
  const body = JSON.parse(data) as {
    result: { isError?: boolean; content: Array<{ text: string }> };
  };
  expect(body.result.isError, body.result.content[0]?.text).toBeFalsy();
  return JSON.parse(body.result.content[0].text);
}

it("turns an outsider agent's status change into a request the creator's agent accepts", async () => {
  const { app } = createApp();
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.startsWith("/api/"))
      return app.request(`${url.pathname}${url.search}`, init);
    return realFetch(input, init);
  });

  const creator = await signUp(app, "Creator");
  const outsider = await signUp(app, "Outsider");
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: `workspace-${randomUUID()}`,
      name: "MCP workspace",
      slug: `mcp-${randomUUID()}`,
      createdAt: new Date(),
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values(
    [creator, outsider].map(({ user }) => ({
      workspaceId: workspace.id,
      userId: user.id,
      role: "member",
      joinedAt: new Date(),
    })),
  );
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "MCP",
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Agent task",
      status: "to-do",
      number: 1,
      createdBy: creator.user.id,
    })
    .returning();

  // Each person connects an agent through OAuth; the tokens are MCP grants.
  const creatorAgent = await connectMcpAgent(app, { bearer: creator.token });
  const outsiderAgent = await connectMcpAgent(app, { bearer: outsider.token });

  const asked = await callTool(
    app,
    outsiderAgent.accessToken,
    "update_task_status",
    {
      taskId: task.id,
      status: "in-progress",
    },
  );
  expect(asked).toMatchObject({
    outcome: "requested",
    task: { status: "to-do" },
    request: { state: "pending", channel: "agent" },
  });
  const requestId = asked.request.id as string;
  expect((await readTask(task.id))?.status).toBe("to-do");

  const waiting = await callTool(
    app,
    creatorAgent.accessToken,
    "list_change_requests",
    {
      workspaceId: workspace.id,
      canAnswer: true,
    },
  );
  expect(JSON.stringify(waiting)).toContain(requestId);

  const accepted = await callTool(
    app,
    creatorAgent.accessToken,
    "answer_change_request",
    {
      requestId,
      decision: "accept",
    },
  );
  expect(accepted).toMatchObject({
    request: { id: requestId, state: "accepted", decidedChannel: "agent" },
    task: { status: "in-progress" },
  });
  expect((await readRequest(requestId))?.decidedBy).toBe(creator.user.id);

  const read = await callTool(
    app,
    outsiderAgent.accessToken,
    "get_change_request",
    {
      requestId,
    },
  );
  expect(read).toMatchObject({ state: "accepted" });
});
