import * as email from "@baton/email";
import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { subscribeToEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { encryptSecret } from "../../apps/api/src/notification-preferences/secrets";
import { deliverNotification } from "../../apps/api/src/notification-preferences/delivery";
import { activeIntegrationCondition } from "../../apps/api/src/plugins/active-integration-condition";
import { sendDm } from "../../apps/api/src/slack-dm/send-dm";
import { openBlockingLinks } from "../../apps/api/src/slack-dm/task-facts";
import { sendOutboundRequest } from "../../apps/api/src/utils/outbound-request";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const slack = vi.hoisted(() => ({
  post: vi.fn(async () => ({ kind: "sent" as const })),
}));
vi.mock("../../apps/api/src/slack-dm/slack-api", async (original) => ({
  ...(await original<object>()),
  postSlackDm: slack.post,
}));
vi.mock("../../apps/api/src/slack-dm/resolve-slack-user", () => ({
  resolveSlackUser: vi.fn(async () => "U0SLACKUSER"),
}));
vi.mock("@baton/email", async (original) => ({
  ...(await original<object>()),
  sendNotificationEmail: vi.fn(async () => undefined),
}));
vi.mock("../../apps/api/src/utils/outbound-request", async (original) => ({
  ...(await original<object>()),
  sendOutboundRequest: vi.fn(async () => new Response(null, { status: 200 })),
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("BATON_CLIENT_URL", "https://baton.test");
  vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "notification-test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

type TourStart = {
  demoWorkspace: { id: string; projectId: string };
  tasks: { key: string; id: string }[];
};

/** A user with a team workspace (with a project) and a fresh demo. */
async function seed() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  mockAuthenticatedSession(user);
  const response = await createApp().app.request("/api/tour/start", {
    method: "POST",
  });
  expect(response.status).toBe(200);
  const demo = (await response.json()) as TourStart;
  const taskId = (key: string) => demo.tasks.find((t) => t.key === key)!.id;
  return { user, workspace, project, demo, taskId };
}

/** Email and Gotify on, for every workspace. */
async function enableEveryChannel(userId: string, workspaceIds: string[]) {
  await db.insert(schema.userNotificationPreferenceTable).values({
    userId,
    emailEnabled: true,
    gotifyEnabled: true,
    gotifyServerUrl: "https://gotify.example",
    gotifyToken: encryptSecret("gotify-test-token"),
    taskStatusChangeEnabled: true,
    taskCommentEnabled: true,
  });
  for (const workspaceId of workspaceIds)
    await db.insert(schema.userNotificationWorkspaceRuleTable).values({
      userId,
      workspaceId,
      isActive: true,
      emailEnabled: true,
      gotifyEnabled: true,
      projectMode: "all",
    });
}

describe("side-effect guard sinks", () => {
  it("sendDm skips a demo workspace and still sends for a team one", async () => {
    const { user, workspace, demo } = await seed();

    expect(
      await sendDm(user.id, "hello", { workspaceId: demo.demoWorkspace.id }),
    ).toBe("skipped_demo_workspace");
    expect(slack.post).not.toHaveBeenCalled();

    expect(await sendDm(user.id, "hello", { workspaceId: workspace.id })).toBe(
      "sent",
    );
    expect(slack.post).toHaveBeenCalledTimes(1);
  });

  it("deliverNotification sends no email or push for a demo task, and does for a team task", async () => {
    const { user, workspace, project, demo, taskId } = await seed();
    await enableEveryChannel(user.id, [workspace.id, demo.demoWorkspace.id]);
    const send = vi.spyOn(email, "sendNotificationEmail");

    const [demoNote] = await db
      .insert(schema.notificationTable)
      .values({
        userId: user.id,
        type: "task_status_changed",
        title: "Demo",
        content: "Demo",
        resourceType: "task",
        resourceId: taskId("api-endpoint"),
      })
      .returning();
    await deliverNotification(demoNote!.id);
    expect(send).not.toHaveBeenCalled();
    expect(sendOutboundRequest).not.toHaveBeenCalled();

    const [teamTask] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Real", userId: user.id })
      .returning();
    const [teamNote] = await db
      .insert(schema.notificationTable)
      .values({
        userId: user.id,
        type: "task_status_changed",
        title: "Team",
        content: "Team",
        resourceType: "task",
        resourceId: teamTask!.id,
      })
      .returning();
    await deliverNotification(teamNote!.id);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sendOutboundRequest).toHaveBeenCalledTimes(1);
  });

  it("integrations never act in a demo workspace", async () => {
    const { project, demo } = await seed();
    await db.insert(schema.integrationTable).values([
      { projectId: project.id, type: "github", config: "{}" },
      { projectId: demo.demoWorkspace.projectId, type: "github", config: "{}" },
    ]);
    const active = await db
      .select({ projectId: schema.integrationTable.projectId })
      .from(schema.integrationTable)
      .where(and(activeIntegrationCondition()));
    expect(active).toEqual([{ projectId: project.id }]);
  });

  it("the Slack digest lists blocking links from team workspaces only", async () => {
    const { user, workspace, project, demo } = await seed();
    const { user: teammate } = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: teammate.id,
      joinedAt: new Date(),
    });
    const [blocker, blocked] = await db
      .insert(schema.taskTable)
      .values([
        { projectId: project.id, title: "Blocker", userId: user.id, number: 1 },
        {
          projectId: project.id,
          title: "Blocked",
          userId: teammate.id,
          number: 2,
        },
      ])
      .returning();
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: blocker!.id,
      targetTaskId: blocked!.id,
      relationType: "blocks",
    });

    const links = await openBlockingLinks("https://baton.test");
    expect(links.map((link) => link.blocker.workspaceId)).toEqual([
      workspace.id,
    ]);
    expect(JSON.stringify(links)).not.toContain(demo.demoWorkspace.id);
  });
});

describe("a status change in the demo workspace", () => {
  it("publishes the live event and an activity row, and nothing leaves Baton", async () => {
    const { user, demo, taskId } = await seed();
    await enableEveryChannel(user.id, [demo.demoWorkspace.id]);
    const send = vi.spyOn(email, "sendNotificationEmail");
    const events: { taskId: string; newStatus: string }[] = [];
    await subscribeToEvent<{ taskId: string; newStatus: string }>(
      "task.status_changed",
      async (event) => {
        events.push(event);
      },
    );

    // Finishing the endpoint is the tour's handoff: write-tests unblocks.
    const response = await createApp().app.request(
      `/api/task/status/${taskId("api-endpoint")}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      },
    );
    expect(response.status).toBe(200);

    await vi.waitFor(() =>
      expect(events).toContainEqual(
        expect.objectContaining({
          taskId: taskId("api-endpoint"),
          newStatus: "done",
        }),
      ),
    );
    // The waits-on lock is gone: write-tests can now be finished.
    const board = await createApp().app.request(
      `/api/board/workspace/${demo.demoWorkspace.id}`,
    );
    const items = (
      (await board.json()) as {
        tasks: { id: string; waitsOn: unknown[] }[];
      }
    ).tasks;
    expect(items.find((i) => i.id === taskId("write-tests"))?.waitsOn).toEqual(
      [],
    );

    // Only the local activity lane gets outbox rows for a demo workspace.
    const outbox = await db
      .select({ consumer: schema.outboxTable.consumer })
      .from(schema.outboxTable)
      .where(eq(schema.outboxTable.workspaceId, demo.demoWorkspace.id));
    expect(outbox.every((row) => row.consumer === "activity")).toBe(true);

    // Give fire-and-forget subscribers a moment, then check every sink.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(slack.post).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(sendOutboundRequest).not.toHaveBeenCalled();
  });
});
