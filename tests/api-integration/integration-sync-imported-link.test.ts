import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { handleIssueOpened } from "../../apps/api/src/plugins/github/webhooks/issue-opened";
import { canSyncTask } from "../../apps/api/src/plugins/sync/eligibility";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const mocks = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("../../apps/api/src/events", () => ({ publishEvent: mocks.publish }));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({
    getInstallationOctokit: async () => ({
      rest: { issues: { createComment: async () => {} } },
    }),
  }),
}));
beforeEach(async () => {
  await resetTestDatabase();
  mocks.publish.mockReset().mockResolvedValue(undefined);
});

it.each(
  (["github"] as const).flatMap((provider) =>
    [true, false].map((qualifying) => ({ provider, qualifying })),
  ),
)(
  "$provider webhook imports links with their committed outgoing scope (qualifying=$qualifying)",
  async ({ provider, qualifying }) => {
    const { workspace, user } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [label] = await db
      .insert(schema.labelTable)
      .values({ workspaceId: workspace.id, name: "export", color: "red" })
      .returning();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: provider,
        isActive: true,
        config: JSON.stringify({
          repositoryOwner: "team",
          repositoryName: "repo",
          repositoryId: 1,
          installationId: 2,
          verifiedGithubAccountId: "3",
          verifiedByUserId: user.id,
          baseUrl: "https://git.example",
          projectPath: "team/repo",
          accessToken: "fake-test-token",
          commentTaskLinkOnGitHubIssue: false,
          syncRules: {
            outgoing: { mode: "labels", match: "any", labels: [label.id] },
            incoming: { mode: "all" },
          },
        }),
      })
      .returning();
    const labels = qualifying ? ["export"] : ["other"];
    const issue = {
      number: 9,
      title: "Imported issue",
      body: "Body",
      html_url: "https://git.example/team/repo/issues/9",
      labels: labels.map((name) => ({ name, color: "1a2b3c" })),
      user: { login: "author" },
    };
    const repository = {
      id: 1,
      owner: { login: "team" },
      name: "repo",
      full_name: "team/repo",
      html_url: "https://git.example/team/repo",
    };
    await handleIssueOpened(
      { action: "opened", installation: { id: 2 }, issue, repository },
      integration.id,
    );
    const link = (await db.query.externalLinkTable.findMany())[0]!;
    expect(link).toBeDefined();
    expect(JSON.parse(link.metadata!).syncFilterPaused === true).toBe(
      !qualifying,
    );
    const assigned = await db.query.labelTable.findFirst({
      where: eq(schema.labelTable.taskId, link.taskId),
    });
    expect(assigned?.color).toBe(qualifying ? label.color : "#1a2b3c");
    if (!qualifying) {
      await db.insert(schema.labelTable).values({
        taskId: link.taskId,
        workspaceId: workspace.id,
        name: label.name,
        color: label.color,
      });
      expect(await canSyncTask(link.taskId, integration.id)).toBe(false);
      expect(
        await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, link.id),
        }),
      ).toMatchObject({ id: link.id, integrationId: integration.id });
    }
  },
);
