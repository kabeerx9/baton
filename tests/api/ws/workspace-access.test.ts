import { beforeEach, expect, it, vi } from "vite-plus/test";
import { userTable } from "../../../apps/api/src/database/schema";
import type { WSContext } from "hono/ws";
import {
  hasWorkspaceAccess,
  syncWorkspaceAccess,
} from "../../../apps/api/src/ws/workspace-access";
const m = vi.hoisted(() => ({
  user: vi.fn(),
  memberships: vi.fn(),
}));
vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => (table === userTable ? m.user() : m.memberships()),
      }),
    }),
  },
}));
beforeEach(() => {
  m.user.mockResolvedValue([{ id: "user" }]);
  m.memberships.mockResolvedValue([{ workspaceId: "still-authorized" }]);
});
it("sends current workspace access when reconnecting after an offline removal", async () => {
  const ws = { send: vi.fn(), close: vi.fn() };
  await syncWorkspaceAccess("user", ws as unknown as WSContext);
  expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
    type: "WORKSPACE_ACCESS_SYNC",
    workspaceIds: ["still-authorized"],
  });
});
it("gives an instance administrator only their memberships", async () => {
  m.memberships.mockResolvedValue([]);
  const ws = { send: vi.fn(), close: vi.fn() };
  await syncWorkspaceAccess("admin", ws as unknown as WSContext);
  expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
    type: "WORKSPACE_ACCESS_SYNC",
    workspaceIds: [],
  });
});
it("requires a reconnect if access synchronization fails", async () => {
  m.memberships.mockRejectedValueOnce(new Error("database unavailable"));
  const ws = { send: vi.fn(), close: vi.fn() };
  await syncWorkspaceAccess("user", ws as unknown as WSContext);
  expect(ws.send).not.toHaveBeenCalled();
  expect(ws.close).toHaveBeenCalledWith(
    1011,
    "Workspace access synchronization failed",
  );
});

it("recognizes restored membership for delayed revocations", async () => {
  expect(await hasWorkspaceAccess("user", "still-authorized")).toBe(true);
  m.memberships.mockResolvedValue([]);
  expect(await hasWorkspaceAccess("user", "removed")).toBe(false);
  m.memberships.mockResolvedValue([{ userId: "user" }]);
  expect(await hasWorkspaceAccess("user", "restored")).toBe(true);
});
