import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { assertNoBlocksCycle } from "../../apps/api/src/task-relation/assert-no-blocks-cycle";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

function link(sourceTaskId: string, targetTaskId: string) {
  return createApp().app.request("/api/task-relation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceTaskId,
      targetTaskId,
      relationType: "blocks",
    }),
  });
}

async function seedLink(sourceTaskId: string, targetTaskId: string) {
  await db
    .insert(schema.taskRelationTable)
    .values({ sourceTaskId, targetTaskId, relationType: "blocks" });
}

async function seed() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const alpha = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "alpha",
  });
  const beta = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "beta",
  });
  const insert = async (projectId: string, count: number) =>
    db
      .insert(schema.taskTable)
      .values(
        Array.from({ length: count }, (_, i) => ({
          projectId,
          number: i + 1,
          title: `Task ${i + 1}`,
        })),
      )
      .returning();
  return {
    owner,
    workspace,
    alpha: await insert(alpha.project.id, 6),
    beta: await insert(beta.project.id, 1),
    alphaId: alpha.project.id,
  };
}

describe("API integration: blocks links cannot form a loop", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects the link that closes a three-task loop", async () => {
    const { owner, alpha } = await seed();
    const [a, b, c] = alpha;
    mockAuthenticatedSession(owner);

    expect((await link(a.id, b.id)).status).toBe(200);
    expect((await link(b.id, c.id)).status).toBe(200);
    const refused = await link(c.id, a.id);
    expect(refused.status).toBe(409);
    expect(await refused.text()).toContain("would create a loop");

    const rows = await db.query.taskRelationTable.findMany();
    expect(rows).toHaveLength(2);
  });

  it("allows a long chain and links that join branches", async () => {
    const { owner, alpha } = await seed();
    mockAuthenticatedSession(owner);

    for (let i = 0; i < alpha.length - 1; i++) {
      expect((await link(alpha[i].id, alpha[i + 1].id)).status).toBe(200);
    }
    // A shortcut along the chain's direction is not a loop.
    expect((await link(alpha[0].id, alpha[5].id)).status).toBe(200);
    // Closing the chain from its end is.
    expect((await link(alpha[5].id, alpha[0].id)).status).toBe(409);
  });

  it("names no hidden task when the loop runs through a repo the caller cannot see", async () => {
    const { workspace, alpha, beta, alphaId } = await seed();
    const member = await addWorkspaceMember(workspace.id);
    await restrictToProjects(workspace.id, member.id, [alphaId]);
    const [a1, a2] = alpha;
    const [b1] = beta;
    // a1 > b1 > a2, with b1 hidden from the member.
    await seedLink(a1.id, b1.id);
    await seedLink(b1.id, a2.id);
    mockAuthenticatedSession(member);

    const refused = await link(a2.id, a1.id);
    expect(refused.status).toBe(409);
    const message = await refused.text();
    expect(message).toContain("would create a loop");
    expect(message).not.toContain("beta");
    expect(message).not.toContain(b1.id);
  });

  it("makes a second transaction wait and then see the first one's link", async () => {
    const { workspace, alpha } = await seed();
    const [a, b, c] = alpha;
    await seedLink(a.id, b.id);

    // Transaction 1 adds c > a and holds its commit open.
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let checked!: () => void;
    const firstChecked = new Promise<void>((resolve) => {
      checked = resolve;
    });
    const first = db.transaction(async (tx) => {
      await assertNoBlocksCycle(tx, workspace.id, c.id, a.id);
      await tx.insert(schema.taskRelationTable).values({
        sourceTaskId: c.id,
        targetTaskId: a.id,
        relationType: "blocks",
      });
      checked();
      await held;
    });
    await firstChecked;

    // Transaction 2 tries b > c, which closes a > b > c > a. Without the lock
    // it would not see the uncommitted c > a and both would commit.
    const second = db.transaction(async (tx) => {
      await assertNoBlocksCycle(tx, workspace.id, b.id, c.id);
      await tx.insert(schema.taskRelationTable).values({
        sourceTaskId: b.id,
        targetTaskId: c.id,
        relationType: "blocks",
      });
    });
    const secondResult = second.then(
      () => "committed",
      (error: { status?: number }) => error.status,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    release();
    await first;
    expect(await secondResult).toBe(409);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(2);
  });

  it("rejects a loop made through the board's update-by-key path", async () => {
    const { owner, workspace, alpha } = await seed();
    const [a, b, c] = alpha;
    await seedLink(a.id, b.id);
    await seedLink(b.id, c.id);
    mockAuthenticatedSession(owner);

    // alpha-1 waiting on alpha-3 would close a > b > c > a.
    const response = await createApp().app.request(
      `/api/board/workspace/${workspace.id}/item/alpha-1`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ waitsOn: ["alpha-3"] }),
      },
    );
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("would create a loop");
  });
});
