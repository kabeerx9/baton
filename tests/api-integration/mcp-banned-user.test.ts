import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { connectMcpAgent, mcpPost, refresh } from "./helpers/mcp-oauth";

async function signUp(app: ReturnType<typeof createApp>["app"]) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      name: "MCP user",
      email: `${randomUUID()}@example.com`,
      password: "mcp-banned-user-password",
    }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    token: string;
    user: { id: string };
  };
  return { token: body.token, userId: body.user.id };
}

describe("API integration: MCP access for banned users", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("refuses a plain browser session token on /api/mcp", async () => {
    const { app } = createApp();
    const { token } = await signUp(app);
    const response = await mcpPost(app, token, "tools/list");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      "resource_metadata=",
    );
  });

  it("stops serving an MCP grant once its owner is banned, on both endpoints", async () => {
    const { app } = createApp();
    const { token, userId } = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: token });

    expect((await mcpPost(app, agent.accessToken, "tools/list")).status).toBe(
      200,
    );

    // A direct write skips the auth hooks: the per-call ban check alone holds.
    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, userId));

    expect((await mcpPost(app, agent.accessToken, "tools/list")).status).toBe(
      401,
    );
    expect(
      (
        await app.request("/api/workspace", {
          headers: { authorization: `Bearer ${agent.accessToken}` },
        })
      ).status,
    ).toBe(401);
    expect((await refresh(app, agent)).status).toBe(400);
  });
});
