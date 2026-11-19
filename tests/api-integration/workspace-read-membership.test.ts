import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { ensureBoardProject } from "../../apps/api/src/board/controllers/ensure-board-project";
import { as, createKey, withKey } from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

// Membership implies workspace:read. A custom role that leaves it out must
// not hide the workspace from its own members.

beforeEach(resetTestDatabase);

async function seed() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: workspace.id,
    role: "custom-viewer",
    permission: JSON.stringify({ task: ["read", "update_assigned"] }),
  });
  const custom = await addWorkspaceMember(workspace.id, "custom-viewer");
  const { user: outsider } = await createWorkspaceMember();
  await ensureBoardProject(workspace.id);
  return { owner, workspace, custom, outsider };
}

async function listedIds(response: Response) {
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }[]).map((row) => row.id);
}

describe("workspace:read follows membership", () => {
  it("lists and opens the workspace for a role without workspace:read", async () => {
    const f = await seed();
    const send = as(f.custom);
    expect(await listedIds(await send("/api/workspace"))).toContain(
      f.workspace.id,
    );
    const one = await send(`/api/workspace/${f.workspace.id}`);
    expect(one.status).toBe(200);
    expect(((await one.json()) as { role: string }).role).toBe("custom-viewer");
    const board = await send(`/api/board/workspace/${f.workspace.id}`);
    expect(board.status).toBe(200);
  });

  it("grants nothing else the role leaves out", async () => {
    const f = await seed();
    const response = await as(f.custom)(
      `/api/board/workspace/${f.workspace.id}`,
      { method: "POST", body: JSON.stringify({ title: "Not allowed" }) },
    );
    expect(response.status).toBe(403);
  });

  it("still hides the workspace from a non-member", async () => {
    const f = await seed();
    const send = as(f.outsider);
    expect(await listedIds(await send("/api/workspace"))).not.toContain(
      f.workspace.id,
    );
    expect((await send(`/api/workspace/${f.workspace.id}`)).status).toBe(404);
  });

  it("still refuses an API key whose scope leaves out workspace:read", async () => {
    const f = await seed();
    const { key } = await createKey(f.custom.id, { task: ["read"] });
    expect((await withKey(key)("/api/workspace")).status).toBe(403);
  });
});
