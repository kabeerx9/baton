import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  answer,
  changeRequestFixture,
  moveToNewWorkspace,
  outcomeNotifications,
  requestStatus,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

// R2-N2: an outcome filed as history (the task is moved or hidden) must not
// send a Slack link that names where the task is now.

const slack = vi.hoisted(() => ({ sendDm: vi.fn(async () => "sent") }));
vi.mock("../../apps/api/src/slack-dm/send-dm", () => ({
  sendDm: slack.sendDm,
}));

beforeEach(async () => {
  await resetTestDatabase();
  slack.sendDm.mockClear();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("BATON_CLIENT_URL", "https://baton.test");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function messagesTo(userId: string) {
  return slack.sendDm.mock.calls
    .filter(([recipient]) => recipient === userId)
    .map(([, text]) => String(text));
}

describe("outcome Slack messages", () => {
  it("links the task when the requester can still see it", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    expect((await answer(f.creator, requestId, "reject")).status).toBe(200);

    const [text] = messagesTo(f.outsider.id);
    expect(text).toContain(
      `https://baton.test/dashboard/workspace/${f.workspace.id}/project/${f.project.id}/task/${f.task.id}`,
    );
  });

  it("sends no link when the task is in a project the requester cannot see", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    const other = await createProjectFixture({ workspaceId: f.workspace.id });
    await restrictToProjects(f.workspace.id, f.outsider.id, [other.project.id]);
    expect((await answer(f.creator, requestId, "reject")).status).toBe(200);

    expect(await outcomeNotifications(f.outsider.id)).toEqual([
      expect.objectContaining({ resourceType: "workspace" }),
    ]);
    const texts = messagesTo(f.outsider.id);
    expect(texts).toHaveLength(1);
    expect(texts[0]).not.toContain(f.project.id);
    expect(texts[0]).not.toContain("https://baton.test");
  });

  it("sends no link that names the workspace a task moved to", async () => {
    const f = await changeRequestFixture();
    await requestStatus(f.outsider, f.task.id, "in-progress");
    // The move cancels the pending request and tells the requester.
    const target = await moveToNewWorkspace(f, f.creator);

    expect(await outcomeNotifications(f.outsider.id)).toEqual([
      expect.objectContaining({
        resourceType: "workspace",
        resourceId: f.workspace.id,
      }),
    ]);
    const texts = messagesTo(f.outsider.id);
    expect(texts).toHaveLength(1);
    expect(texts[0]).not.toContain(target.id);
    expect(texts[0]).not.toContain(f.project.id);
    expect(texts[0]).not.toContain("https://baton.test");
  });
});
