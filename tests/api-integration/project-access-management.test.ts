import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
import { projectAccessApi } from "./helpers/project-access/project-access-api";
import { putMemberProjectAccess } from "./helpers/project-access/put-member-project-access";
import { readMemberAccessRows } from "./helpers/project-access/read-member-access-rows";

beforeEach(resetTestDatabase);

describe("managing member project access", () => {
  it("restricts a member and lifts the restriction again", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    mockAuthenticatedSession(ctx.owner);
    const request = projectAccessApi();

    const restricted = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      member.id,
      {
        projectAccess: "selected",
        projectIds: [ctx.beta.id],
      },
    );
    expect(restricted.status).toBe(200);
    expect(await restricted.json()).toEqual({
      userId: member.id,
      projectAccess: "selected",
      projectIds: [ctx.beta.id],
    });

    const listed = await request(
      `/workspace/${ctx.workspace.id}/project-access`,
    );
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual(
      expect.arrayContaining([
        {
          userId: member.id,
          projectAccess: "selected",
          projectIds: [ctx.beta.id],
        },
        {
          userId: ctx.restricted.id,
          projectAccess: "selected",
          projectIds: [ctx.alpha.id],
        },
      ]),
    );

    mockAuthenticatedSession(member);
    expect((await projectAccessApi()(`/project/${ctx.alpha.id}`)).status).toBe(
      403,
    );
    expect((await projectAccessApi()(`/project/${ctx.beta.id}`)).status).toBe(
      200,
    );

    mockAuthenticatedSession(ctx.owner);
    const lifted = await putMemberProjectAccess(
      projectAccessApi(),
      ctx.workspace.id,
      member.id,
      {
        projectAccess: "all",
      },
    );
    expect(lifted.status).toBe(200);
    expect(await readMemberAccessRows(ctx.workspace.id, member.id)).toEqual({
      rules: [],
      grants: [],
    });

    mockAuthenticatedSession(member);
    expect((await projectAccessApi()(`/project/${ctx.alpha.id}`)).status).toBe(
      200,
    );
  });

  it("tells each member their own project access", async () => {
    const ctx = await createRestrictedWorkspace();

    mockAuthenticatedSession(ctx.restricted);
    const restricted = await projectAccessApi()(
      `/workspace/${ctx.workspace.id}/project-access/me`,
    );
    expect(restricted.status).toBe(200);
    expect(await restricted.json()).toEqual({
      userId: ctx.restricted.id,
      projectAccess: "selected",
      projectIds: [ctx.alpha.id],
    });

    mockAuthenticatedSession(ctx.owner);
    const owner = await projectAccessApi()(
      `/workspace/${ctx.workspace.id}/project-access/me`,
    );
    expect(await owner.json()).toMatchObject({ projectAccess: "all" });
  });

  it("refuses to restrict owners or yourself", async () => {
    const ctx = await createRestrictedWorkspace();
    const admin = await addWorkspaceMember(ctx.workspace.id, "admin");
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();

    const owner = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      ctx.owner.id,
      {
        projectAccess: "selected",
        projectIds: [ctx.alpha.id],
      },
    );
    expect(owner.status).toBe(400);

    const self = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      admin.id,
      {
        projectAccess: "selected",
        projectIds: [ctx.alpha.id],
      },
    );
    expect(self.status).toBe(403);
  });

  it("requires permission to manage members", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    mockAuthenticatedSession(member);
    const request = projectAccessApi();

    expect(
      (await request(`/workspace/${ctx.workspace.id}/project-access`)).status,
    ).toBe(403);
    expect(
      (
        await putMemberProjectAccess(
          request,
          ctx.workspace.id,
          ctx.restricted.id,
          {
            projectAccess: "all",
          },
        )
      ).status,
    ).toBe(403);
  });

  it("stops a restricted admin from granting more than they can see", async () => {
    const ctx = await createRestrictedWorkspace();
    const admin = await addWorkspaceMember(ctx.workspace.id, "admin");
    await restrictToProjects(ctx.workspace.id, admin.id, [ctx.alpha.id]);
    const unrestricted = await addWorkspaceMember(ctx.workspace.id);
    const member = await addWorkspaceMember(ctx.workspace.id);
    await restrictToProjects(ctx.workspace.id, member.id, [ctx.beta.id]);
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();

    const hidden = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      member.id,
      {
        projectAccess: "selected",
        projectIds: [ctx.beta.id],
      },
    );
    expect(hidden.status).toBe(403);

    const everything = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      member.id,
      {
        projectAccess: "all",
      },
    );
    expect(everything.status).toBe(403);

    const narrowed = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      unrestricted.id,
      { projectAccess: "selected", projectIds: [ctx.alpha.id] },
    );
    expect(narrowed.status).toBe(403);

    const visible = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      member.id,
      {
        projectAccess: "selected",
        projectIds: [ctx.alpha.id],
      },
    );
    expect(visible.status).toBe(200);
    expect(
      ((await visible.json()) as { projectIds: string[] }).projectIds,
    ).toEqual([ctx.alpha.id]);
    const stored = await readMemberAccessRows(ctx.workspace.id, member.id);
    expect(stored.grants.map((grant) => grant.projectId).sort()).toEqual(
      [ctx.alpha.id, ctx.beta.id].sort(),
    );

    const listed = await request(
      `/workspace/${ctx.workspace.id}/project-access`,
    );
    expect(listed.status).toBe(200);
    const entries = (await listed.json()) as {
      userId: string;
      projectIds: string[];
    }[];
    expect(JSON.stringify(entries)).not.toContain(ctx.beta.id);
    expect(entries.find((entry) => entry.userId === member.id)).toMatchObject({
      projectIds: [ctx.alpha.id],
    });
  });

  it("unassigns a member from tasks in projects they lose", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    await db
      .update(schema.taskTable)
      .set({ userId: member.id })
      .where(eq(schema.taskTable.id, ctx.betaTask.id));
    mockAuthenticatedSession(ctx.owner);

    const restricted = await putMemberProjectAccess(
      projectAccessApi(),
      ctx.workspace.id,
      member.id,
      { projectAccess: "selected", projectIds: [ctx.alpha.id] },
    );

    expect(restricted.status).toBe(200);
    const [task] = await db
      .select({ userId: schema.taskTable.userId })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, ctx.betaTask.id));
    expect(task?.userId).toBeNull();
    const activities = await db
      .select({ type: schema.activityTable.type })
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, ctx.betaTask.id));
    expect(activities.map((activity) => activity.type)).toContain("unassigned");
  });

  it("rejects projects from another workspace", async () => {
    const ctx = await createRestrictedWorkspace();
    const other = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.owner);

    const response = await putMemberProjectAccess(
      projectAccessApi(),
      ctx.workspace.id,
      ctx.restricted.id,
      { projectAccess: "selected", projectIds: [other.alpha.id] },
    );

    expect(response.status).toBe(400);
  });
});

describe("notification rules with project access", () => {
  it("keeps projects a member lost when they save the rule again", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    mockAuthenticatedSession(member);
    const request = projectAccessApi();
    const rule = (projectIds: string[]) =>
      request(`/notification-preferences/workspaces/${ctx.workspace.id}`, {
        method: "PUT",
        body: {
          isActive: true,
          emailEnabled: false,
          ntfyEnabled: false,
          gotifyEnabled: false,
          webhookEnabled: false,
          projectMode: "selected",
          selectedProjectIds: projectIds,
        },
      });

    expect((await rule([ctx.alpha.id, ctx.beta.id])).status).toBe(200);
    await restrictToProjects(ctx.workspace.id, member.id, [ctx.alpha.id]);

    const read = await request("/notification-preferences");
    const preferences = (await read.json()) as {
      workspaces: { selectedProjectIds: string[] }[];
    };
    expect(preferences.workspaces[0]?.selectedProjectIds).toEqual([
      ctx.alpha.id,
    ]);

    expect((await rule([])).status).toBe(200);
    const stored = await db
      .select({
        projectId: schema.userNotificationWorkspaceProjectTable.projectId,
      })
      .from(schema.userNotificationWorkspaceProjectTable);
    expect(stored.map((row) => row.projectId)).toEqual([ctx.beta.id]);
  });
});
