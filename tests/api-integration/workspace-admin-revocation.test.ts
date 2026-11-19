import { and, eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  hasWorkspaceAccess,
  syncWorkspaceAccess,
} from "../../apps/api/src/ws/workspace-access";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

// Instance administrators hold workspace sockets only through membership.
beforeEach(resetTestDatabase);
it("gives an instance administrator no socket access to a workspace they never joined", async () => {
  const admin = await createWorkspaceMember();
  await db
    .update(schema.userTable)
    .set({ role: "user,admin" })
    .where(eq(schema.userTable.id, admin.user.id));
  const { app } = createApp();
  const signup = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "delete-workspace-owner@example.test",
      password: "correct horse battery staple",
      name: "Owner",
    }),
  });
  expect(signup.status).toBe(200);
  const cookie = signup.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  const created = await app.request("/api/workspace", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Deleted workspace" }),
  });
  expect(created.status).toBe(201);
  const workspace = (await created.json()) as { id: string };
  expect(
    await db.query.workspaceUserTable.findFirst({
      where: and(
        eq(schema.workspaceUserTable.workspaceId, workspace.id),
        eq(schema.workspaceUserTable.userId, admin.user.id),
      ),
    }),
  ).toBeUndefined();
  const snapshot = async () => {
    const socket = { send: vi.fn(), close: vi.fn() };
    await syncWorkspaceAccess(admin.user.id, socket as unknown as WSContext);
    return JSON.parse(socket.send.mock.calls[0][0]).workspaceIds as string[];
  };
  expect(await snapshot()).toEqual([admin.workspace.id]);
  expect(await hasWorkspaceAccess(admin.user.id, workspace.id)).toBe(false);
  const deleted = await app.request(`/api/workspace/${workspace.id}`, {
    method: "DELETE",
    headers: { cookie },
  });
  expect(deleted.status).toBe(200);
  expect(await snapshot()).toEqual([admin.workspace.id]);
});
