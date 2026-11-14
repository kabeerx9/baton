import { beforeEach, expect, it, vi } from "vite-plus/test";
import { handleTaskStatusChanged as github } from "../../../../apps/api/src/plugins/github/events/task-status-changed";
const m = vi.hoisted(() => ({
  status: "",
  remote: "",
  write: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
      taskTable: { findFirst: async () => ({ status: m.status }) },
      columnTable: { findFirst: async () => undefined },
    },
  },
}));
vi.mock(
  "../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLinksByTask: async () => [
      {
        id: "link",
        taskId: "task",
        integrationId: "integration",
        resourceType: "issue",
        externalId: "1",
      },
    ],
    updateExternalLink: m.save,
  }),
);
vi.mock("../../../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({}),
  getVerifiedInstallationOctokit: async () => ({
    rest: {
      issues: {
        get: async () => ({ data: { state: m.remote } }),
        update: async ({ state }: { state: string }) => ({
          data: await m.write(state),
        }),
      },
    },
  }),
}));
vi.mock("../../../../apps/api/src/plugins/github/utils/labels", () => ({
  removeLabel: vi.fn(),
  addLabelsToIssue: vi.fn(),
}));
const context = {
  integrationId: "integration",
  projectId: "project",
  config: {
    repositoryOwner: "owner",
    repositoryName: "repo",
    installationId: 1,
    repositoryId: 2,
    verifiedGithubAccountId: "3",
    verifiedByUserId: "user",
    accessToken: "test",
  },
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => vi.resetAllMocks());
it.each([
  ["github", "closed"],
  ["github", "open"],
])(
  "repairs a late %s %s response using the current task state",
  async (_provider, firstState) => {
    const handler = github;
    const finalState = firstState === "closed" ? "open" : "closed";
    const started = deferred();
    const release = deferred();
    let first = true;
    m.remote = finalState;
    m.write.mockImplementation(async (state: string) => {
      if (first) {
        first = false;
        started.resolve();
        await release.promise;
      }
      m.remote = state;
      return { updated_at: `${state}-stamp` };
    });
    m.status = firstState === "closed" ? "done" : "in-progress";
    const event = {
      taskId: "task",
      projectId: "project",
      userId: "user",
      oldStatus: firstState === "closed" ? "in-progress" : "done",
      newStatus: m.status,
    };
    const older = handler(event, context);
    await started.promise;
    m.status = finalState === "closed" ? "done" : "in-progress";
    await handler(
      { ...event, oldStatus: event.newStatus, newStatus: m.status },
      context,
    );
    expect(m.remote).toBe(finalState);
    release.resolve();
    await older;
    expect(m.remote).toBe(finalState);
    // The second move sees the issue already in its state and sends nothing;
    // the late first response is repaired back to the current task state.
    expect(m.write.mock.calls.map(([state]) => state)).toEqual([
      firstState,
      finalState,
    ]);
    expect(m.save.mock.calls.at(-1)?.[1]).toMatchObject({
      outbound: {
        field: "state",
        value: finalState,
        updatedAt: `${finalState}-stamp`,
      },
    });
  },
);

// Policy enforcement is covered by the PostgreSQL sync-rules integration tests.
vi.mock("../../../../apps/api/src/plugins/sync/eligibility", () => ({
  canSyncTask: async () => true,
}));

vi.mock("../../../../apps/api/src/plugins/sync/dispatch-issue-write", () => ({
  createIssueWrite: () => (send: () => Promise<unknown>) => send(),
  dispatchIssueWrite: async (
    _link: unknown,
    _config: unknown,
    send: () => Promise<unknown>,
  ) => ({ value: await send() }),
}));

vi.mock("../../../../apps/api/src/plugins/sync/sync-task-field-labels", () => ({
  syncTaskFieldLabels: async () => m.status,
}));
