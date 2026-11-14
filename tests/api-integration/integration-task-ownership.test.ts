import { eq, sql } from "drizzle-orm";
import * as eligibility from "../../apps/api/src/plugins/sync/eligibility";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import { withIntegrationTask } from "../../apps/api/src/plugins/github/services/integration-task-scope";
import { handleIssueCommentCreated } from "../../apps/api/src/plugins/github/webhooks/issue-comment-created";
import { handleIssueEdited } from "../../apps/api/src/plugins/github/webhooks/issue-edited";
import { handleIssueLabeled } from "../../apps/api/src/plugins/github/webhooks/issue-labeled";
import moveTask from "../../apps/api/src/task/controllers/move-task";
import moveProject from "../../apps/api/src/project/controllers/move-project";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const m = vi.hoisted(() => ({
  publish: vi.fn(async (_type: string, _data: unknown) => undefined),
  getIssue: vi.fn(),
}));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getVerifiedInstallationOctokit: async () => ({
    rest: { issues: { get: async () => ({ data: await m.getIssue() }) } },
  }),
}));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<typeof import("../../apps/api/src/events")>()),
  publishEvent: m.publish,
}));
const remoteIssue = {
  number: 1,
  title: "Remote title",
  body: "Remote description",
  html_url: "https://github.com/owner/repo/issues/1",
  state: "open",
  labels: [],
};
const installation = { id: 1 };
const repository = {
  id: 2,
  owner: { login: "owner" },
  name: "repo",
  full_name: "owner/repo",
  html_url: "https://github.com/owner/repo",
};
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  m.publish.mockReset().mockResolvedValue(undefined);
  m.getIssue.mockReset().mockResolvedValue(remoteIssue);
});
async function setup() {
  const source = await createWorkspaceMember({ role: "owner" });
  const privateWorkspace = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: source.workspace.id,
  });
  const { project: destination } = await createProjectFixture({
    workspaceId: source.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Private title",
      description: "Private description",
      number: 1,
    })
    .returning();
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "github",
      config: JSON.stringify({
        repositoryOwner: "owner",
        repositoryName: "repo",
        installationId: installation.id,
        repositoryId: repository.id,
        verifiedGithubAccountId: "3",
        verifiedByUserId: source.user.id,
      }),
    })
    .returning();
  const [link] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: remoteIssue.html_url,
    })
    .returning();
  return {
    source,
    privateWorkspace,
    project,
    destination,
    task,
    integration,
    link,
  };
}
async function moveWithoutCleanup(fixture: Awaited<ReturnType<typeof setup>>) {
  // Reproduce links left by earlier releases, even after their new project
  // has moved into a private workspace.
  await db
    .update(schema.taskTable)
    .set({ projectId: fixture.destination.id })
    .where(eq(schema.taskTable.id, fixture.task.id));
  await db
    .update(schema.projectTable)
    .set({ workspaceId: fixture.privateWorkspace.workspace.id })
    .where(eq(schema.projectTable.id, fixture.destination.id));
}
async function expectPrivateTask(taskId: string) {
  expect(
    await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, taskId),
    }),
  ).toMatchObject({
    title: "Private title",
    description: "Private description",
  });
  expect(
    await db.query.labelTable.findMany({
      where: eq(schema.labelTable.taskId, taskId),
    }),
  ).toEqual([]);
  expect(
    await db.query.activityTable.findMany({
      where: eq(schema.activityTable.taskId, taskId),
    }),
  ).toEqual([]);
}
describe("integration task ownership", () => {
  it("GitHub edits, labels and comments cannot follow stale links", async () => {
    const f = await setup();
    await moveWithoutCleanup(f);
    await handleIssueEdited({
      action: "edited",
      issue: remoteIssue,
      installation,
      repository,
      changes: {
        title: { from: "Private title" },
        body: { from: "Private description" },
      },
    });
    await handleIssueLabeled({
      action: "labeled",
      issue: {
        number: 1,
        labels: [{ name: "priority:high" }, { name: "bug" }],
      },
      label: { name: "bug", color: "ff0000" },
      installation,
      repository,
    });
    await handleIssueCommentCreated({
      action: "created",
      issue: { number: 1 },
      installation,
      repository,
      comment: {
        id: 4,
        body: "Wrong workspace",
        html_url: `${remoteIssue.html_url}#comment-4`,
        user: { login: "author", avatar_url: "" },
        created_at: new Date().toISOString(),
      },
    });
    await expectPrivateTask(f.task.id);
  });
  it("moving a task removes links to its previous project's integration atomically", async () => {
    const f = await setup();
    const [manual] = await db
      .insert(schema.externalLinkTable)
      .values({
        taskId: f.task.id,
        resourceType: "url",
        integrationId: null,
        url: "https://example.test/manual",
        externalId: "manual",
      })
      .returning();
    await moveTask({
      taskId: f.task.id,
      destinationProjectId: f.destination.id,
      currentUserId: f.source.user.id,
    });
    expect(
      await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      }),
    ).toEqual([manual]);
  });
  it("moving a project removes legacy links owned by another project", async () => {
    const f = await setup();
    await db
      .update(schema.taskTable)
      .set({ projectId: f.destination.id })
      .where(eq(schema.taskTable.id, f.task.id));
    await moveProject(
      f.destination.id,
      f.source.workspace.id,
      f.privateWorkspace.workspace.id,
      f.source.user.id,
    );
    expect(
      await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      }),
    ).toEqual([]);
  });
  it("a concurrent task move waits for scoped integration writes to commit", async () => {
    const f = await setup();
    let release!: () => void;
    let started!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const sync = withIntegrationTask(
      f.task.id,
      { ...f.integration, project: f.project },
      async (tx) => {
        started();
        await barrier;
        await tx
          .update(schema.taskTable)
          .set({ title: "Synced before moving" })
          .where(eq(schema.taskTable.id, f.task.id));
      },
    );
    await ready;
    let moved = false;
    const move = moveTask({
      taskId: f.task.id,
      destinationProjectId: f.destination.id,
      currentUserId: f.source.user.id,
    }).then(() => {
      moved = true;
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(moved).toBe(false);
    } finally {
      release();
    }
    await Promise.all([sync, move]);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, f.task.id),
      }),
    ).toMatchObject({
      projectId: f.destination.id,
      title: "Synced before moving",
    });
    expect(
      await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      }),
    ).toEqual([]);
  });
});

afterEach(() => vi.restoreAllMocks());
it("reports a concurrent move as a conflict without deleting links", async () => {
  const f = await setup();
  const transaction = db.transaction.bind(db);
  vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
    async (apply, config) => {
      await db
        .update(schema.taskTable)
        .set({ projectId: f.destination.id })
        .where(eq(schema.taskTable.id, f.task.id));
      return transaction(apply, config);
    },
  );
  await expect(
    moveTask({
      taskId: f.task.id,
      destinationProjectId: f.destination.id,
      currentUserId: f.source.user.id,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
});

it("preserves legacy links belonging to the destination integration when moving back", async () => {
  const f = await setup();
  const [destinationIntegration] = await db
    .insert(schema.integrationTable)
    .values({ projectId: f.destination.id, type: "github", config: "{}" })
    .returning();
  const [compatible] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId: f.task.id,
      integrationId: destinationIntegration.id,
      resourceType: "issue",
      externalId: "legacy",
      url: "https://github.com/legacy",
    })
    .returning();
  await moveTask({
    taskId: f.task.id,
    destinationProjectId: f.destination.id,
    currentUserId: f.source.user.id,
  });
  expect(await db.query.externalLinkTable.findMany()).toEqual([compatible]);
});

it("preserves outbound history and unrelated fields across concurrent sync completions", async () => {
  const { updateExternalLink } =
    await import("../../apps/api/src/plugins/github/services/link-manager");
  const { isOutboundEcho } =
    await import("../../apps/api/src/plugins/github/utils/sync-echo");
  const { link } = await setup();
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: JSON.stringify({ remoteMarker: "keep" }) })
    .where(eq(schema.externalLinkTable.id, link.id));
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      updateExternalLink(link.id, {
        outbound: {
          field: i % 2 ? "description" : "title",
          value: `edit-${i}`,
          updatedAt: `time-${i}`,
        },
      }),
    ),
  );
  const beforeStateWebhook = await db.query.externalLinkTable.findFirst({
    where: eq(schema.externalLinkTable.id, link.id),
  });
  const latestTitleStamp = JSON.parse(beforeStateWebhook!.metadata!).lastSync
    .title;
  // A state webhook can hold a metadata snapshot predating every outbound write.
  await updateExternalLink(link.id, {
    metadata: {
      remoteMarker: "keep",
      state: "closed",
      lastSync: {
        title: {
          source: "github",
          value: "remote",
          timestamp: "2000-01-01T00:00:00Z",
          outbound: [],
        },
      },
    },
  });
  const saved = await db.query.externalLinkTable.findFirst({
    where: eq(schema.externalLinkTable.id, link.id),
  });
  const metadata = JSON.parse(saved!.metadata!);
  expect(metadata.remoteMarker).toBe("keep");
  expect(metadata.lastSync.title).toEqual(latestTitleStamp);
  for (let i = 0; i < 12; i++)
    expect(
      isOutboundEcho(
        metadata.lastSync[i % 2 ? "description" : "title"],
        `edit-${i}`,
        `time-${i}`,
      ),
    ).toBe(true);
});

it("keeps outbound history committed during an inbound provider read", async () => {
  const { updateExternalLink } =
    await import("../../apps/api/src/plugins/github/services/link-manager");
  const { isOutboundEcho } =
    await import("../../apps/api/src/plugins/github/utils/sync-echo");
  const { link } = await setup();
  const { outboundStamp } =
    await import("../../apps/api/src/plugins/github/utils/sync-echo");
  await db
    .update(schema.externalLinkTable)
    .set({
      metadata: JSON.stringify({
        lastSync: {
          title: outboundStamp(
            outboundStamp(undefined, remoteIssue.title),
            "Latest local",
          ),
        },
      }),
    })
    .where(eq(schema.externalLinkTable.id, link.id));
  m.getIssue.mockImplementationOnce(async () => {
    await updateExternalLink(link.id, {
      outbound: {
        field: "title",
        value: "Local edit",
        updatedAt: "local-time",
      },
    });
    return remoteIssue;
  });
  await handleIssueEdited({
    action: "edited",
    installation,
    repository,
    issue: remoteIssue,
    changes: { title: { from: "Old" } },
  });
  // The outbound metadata change invalidates the first provider confirmation.
  expect(m.getIssue).toHaveBeenCalledTimes(2);
  const saved = await db.query.externalLinkTable.findFirst({
    where: eq(schema.externalLinkTable.id, link.id),
  });
  expect(
    isOutboundEcho(
      JSON.parse(saved!.metadata!).lastSync.title,
      "Local edit",
      "local-time",
    ),
  ).toBe(true);
});
it.each(["edit", "labels", "comment"])(
  "ignores a stale %s webhook after its link is removed during a move and return",
  async (kind) => {
    const f = await setup();
    const transaction = getDatabase().transaction.bind(getDatabase());
    const intercepted = vi
      .spyOn(getDatabase(), "transaction")
      .mockImplementationOnce(async (apply, config) => {
        await moveTask({
          taskId: f.task.id,
          destinationProjectId: f.destination.id,
          currentUserId: f.source.user.id,
        });
        await moveTask({
          taskId: f.task.id,
          destinationProjectId: f.project.id,
          currentUserId: f.source.user.id,
        });
        return transaction(apply, config);
      });
    try {
      if (kind === "edit")
        await handleIssueEdited({
          action: "edited",
          issue: remoteIssue,
          installation,
          repository,
          changes: {
            title: { from: "Private title" },
            body: { from: "Private description" },
          },
        });
      if (kind === "labels")
        await handleIssueLabeled({
          action: "labeled",
          issue: {
            number: 1,
            labels: [{ name: "priority:high" }, { name: "bug" }],
          },
          label: { name: "bug", color: "ff0000" },
          installation,
          repository,
        });
      if (kind === "comment")
        await handleIssueCommentCreated({
          action: "created",
          issue: { number: 1 },
          installation,
          repository,
          comment: {
            id: 4,
            body: "Wrong workspace",
            html_url: `${remoteIssue.html_url}#comment-4`,
            user: { login: "author", avatar_url: "" },
            created_at: new Date().toISOString(),
          },
        });
      await expectPrivateTask(f.task.id);
    } finally {
      intercepted.mockRestore();
    }
  },
);

it("does not apply a webhook after its link is paused while waiting for the link lock", async () => {
  const f = await setup();
  let release!: () => void;
  let locked!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const acquired = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const guard = vi.spyOn(eligibility, "canSyncTask");
  const pause = db.transaction(async (tx) => {
    await tx
      .select()
      .from(schema.externalLinkTable)
      .where(eq(schema.externalLinkTable.id, f.link.id))
      .for("update");
    await tx
      .update(schema.externalLinkTable)
      .set({ metadata: JSON.stringify({ syncFilterPaused: true }) })
      .where(eq(schema.externalLinkTable.id, f.link.id));
    locked();
    await gate;
  });
  await acquired;
  const webhook = handleIssueEdited({
    action: "edited",
    issue: remoteIssue,
    installation,
    repository,
    changes: {
      title: { from: "Private title" },
      body: { from: "Private description" },
    },
  });
  try {
    await vi.waitFor(async () => {
      const waiting = await db.execute<{ blocked: boolean }>(sql`
        select exists (
          select 1 from pg_stat_activity
          where datname = current_database()
            and wait_event_type = 'Lock'
            and query like '%external_link%'
        ) as blocked
      `);
      expect(waiting.rows[0]?.blocked).toBe(true);
    });
    expect(guard).not.toHaveBeenCalled();
    release();
    await pause;
    await webhook;
    expect(guard).toHaveBeenCalledOnce();
    await expectPrivateTask(f.task.id);
  } finally {
    release();
    await pause;
    await webhook;
    guard.mockRestore();
  }
});
