import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { ensureBoardProject } from "../../apps/api/src/board/controllers/ensure-board-project";
import { createApp } from "../../apps/api/src/index";
import { as, createKey } from "./helpers/change-requests";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

// An instance administrator is an ordinary user on tenant routes: a
// non-member gets the same 404 as anyone else. Administration lives only
// under /api/admin, which writes the audit log.

beforeEach(resetTestDatabase);
afterEach(() => vi.unstubAllGlobals());

async function seed() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
    workspaceName: "Tenant",
  });
  const member = await addWorkspaceMember(workspace.id);
  const board = await ensureBoardProject(workspace.id);
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: board.id,
      title: "Tenant secret",
      status: "to-do",
      number: 900,
      position: 1,
      createdBy: owner.id,
      userId: member.id,
    })
    .returning();
  const [label] = await db
    .insert(schema.labelTable)
    .values({ name: "bug", color: "red", workspaceId: workspace.id })
    .returning();
  const admin = await createInstanceAdmin();
  return { owner, member, workspace, board, task: task!, label: label!, admin };
}

type Seed = Awaited<ReturnType<typeof seed>>;
const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

/** Tenant reads and writes, each answered 404 to a non-member. */
function tenantCalls(f: Seed) {
  const ws = f.workspace.id;
  return {
    workspace: [`/api/workspace/${ws}`],
    members: [`/api/workspace/${ws}/members`],
    roles: [`/api/workspace/${ws}/roles`],
    capabilities: [`/api/workspace/${ws}/capabilities`],
    board: [`/api/board/workspace/${ws}`],
    boardItem: [`/api/board/workspace/${ws}/item/${f.task.id}`],
    labels: [`/api/label/workspace/${ws}`],
    changeRequests: [`/api/task-change-request?workspaceId=${ws}`],
    assigned: [`/api/task/assigned?workspaceId=${ws}`],
    search: [`/api/search?q=Tenant&workspaceId=${ws}`],
    task: [`/api/task/${f.task.id}`],
    rename: [`/api/task/title/${f.task.id}`, json("PUT", { title: "Owned" })],
    status: [
      `/api/task/status/${f.task.id}`,
      json("PUT", { status: "in-progress" }),
    ],
    createTask: [`/api/board/workspace/${ws}`, json("POST", { title: "x" })],
    comment: [`/api/comment/${f.task.id}`, json("POST", { content: "hi" })],
    label: [
      `/api/label/${f.label.id}/task`,
      json("PUT", { taskId: f.task.id }),
    ],
    renameWorkspace: [`/api/workspace/${ws}`, json("PATCH", { name: "Mine" })],
  } satisfies Record<string, [string, RequestInit?]>;
}

describe("instance administrator who is not a member", () => {
  it("gets 404 on every tenant read and write", async () => {
    const f = await seed();
    const send = as(f.admin);
    for (const [name, [path, init]] of Object.entries(tenantCalls(f))) {
      const response = await send(path, init);
      expect(response.status, name).toBe(404);
      const text = await response.text();
      expect(text, name).not.toContain(f.member.email);
      expect(text, name).not.toContain("Tenant secret");
    }
    const [task] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, f.task.id));
    expect(task?.title).toBe("Tenant secret");
    expect(task?.status).toBe("to-do");
  });

  it("does not see the workspace in the list or by ticket key", async () => {
    const f = await seed();
    const send = as(f.admin);
    const list = await send("/api/workspace");
    expect(list.status).toBe(200);
    expect(JSON.stringify(await list.json())).not.toContain(f.workspace.id);
    const byKey = await send("/api/task/by-ticket-id/T-900");
    expect(byKey.status).toBe(404);
  });

  it("gets nothing through MCP tools with an API key", async () => {
    const f = await seed();
    const { app } = createApp();
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname.startsWith("/api/"))
        return app.request(`${url.pathname}${url.search}`, init);
      return realFetch(input, init);
    });
    const { key } = await createKey(f.admin.id);
    const board = await callTool(app, key, "get_board", {
      workspaceId: f.workspace.id,
    });
    expect(board.isError).toBe(true);
    expect(board.text).not.toContain("Tenant secret");
    const workspaces = await callTool(app, key, "list_workspaces", {});
    expect(workspaces.text).not.toContain(f.workspace.id);
  });
});

describe("instance administrator who is a member", () => {
  it("acts by the workspace role, with no extra reach", async () => {
    const f = await seed();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: f.workspace.id,
      userId: f.admin.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    const send = as(f.admin);
    expect((await send(`/api/board/workspace/${f.workspace.id}`)).status).toBe(
      200,
    );
    const created = await send(
      `/api/board/workspace/${f.workspace.id}`,
      json("POST", { title: "Viewer cannot" }),
    );
    expect(created.status).toBe(403);
    const renamed = await send(
      `/api/task/title/${f.task.id}`,
      json("PUT", { title: "Not assigned to me" }),
    );
    expect(renamed.status).toBe(403);
  });
});

describe("/api/admin", () => {
  it("still lists the workspace and audits a member change", async () => {
    const f = await seed();
    const send = as(f.admin);
    const listed = await send("/api/admin/workspaces");
    expect(listed.status).toBe(200);
    expect(JSON.stringify(await listed.json())).toContain(f.workspace.id);

    const outsider = await createWorkspaceMember();
    const added = await send(
      `/api/admin/workspaces/${f.workspace.id}/members`,
      json("POST", { userId: outsider.user.id, role: "member" }),
    );
    expect(added.status).toBe(200);
    expect((await readAuditLog()).map((row) => row.action)).toContain(
      "workspace.member_added",
    );
  });
});

type App = ReturnType<typeof createApp>["app"];
const protocolVersion = "2026-07-28";

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
            name: "baton-admin-bypass-test",
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
  return {
    isError: Boolean(body.result.isError),
    text: body.result.content.map((part) => part.text).join("\n"),
  };
}
