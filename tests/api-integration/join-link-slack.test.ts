import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetJoinLinkRateLimits } from "../../apps/api/src/join-link/rate-limit";
import { resetTestDatabase } from "./helpers/database";
import { joinLinkFixture } from "./helpers/join-link";

const slack = vi.hoisted(() => ({ sendDm: vi.fn(async () => "sent") }));
vi.mock("../../apps/api/src/slack-dm/send-dm", () => ({
  sendDm: slack.sendDm,
}));

beforeEach(async () => {
  await resetTestDatabase();
  resetJoinLinkRateLimits();
  slack.sendDm.mockClear();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("BATON_CLIENT_URL", "https://baton.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

function welcomesTo(userId: string) {
  return slack.sendDm.mock.calls.filter(
    (call) => (call as unknown[])[0] === userId,
  ) as unknown as [string, string, { workspaceId: string }][];
}

describe("Slack welcome on join", () => {
  it("sends one welcome naming the workspace, the sharer and the board", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const joiner = await ctx.person();
    expect((await ctx.join(joiner, token)).status).toBe(200);

    await vi.waitFor(() => expect(welcomesTo(joiner.userId)).toHaveLength(1));
    await settle();
    expect(welcomesTo(joiner.userId)).toEqual([
      [
        joiner.userId,
        `*Welcome to Join Team on Baton!* Owner Person added you through a join link.\n<https://baton.test/dashboard/workspace/${ctx.workspace.id}/board|Open the board>`,
        { workspaceId: ctx.workspace.id },
      ],
    ]);
    expect(slack.sendDm).toHaveBeenCalledTimes(1);
  });

  it("sends nothing to a person who is already a member", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const response = await ctx.join(ctx.owner, token);
    expect(await response.json()).toMatchObject({ outcome: "already_member" });
    await settle();
    expect(slack.sendDm).not.toHaveBeenCalled();
  });

  it("sends nothing without a Slack token", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "");
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    expect((await ctx.join(await ctx.person(), token)).status).toBe(200);
    await settle();
    expect(slack.sendDm).not.toHaveBeenCalled();
  });

  it("leaves out the sharer when their account is gone", async () => {
    const ctx = await joinLinkFixture();
    const sharer = await ctx.person("Sharing Admin");
    await ctx.addMember(sharer, "admin");
    const { token } = await ctx.createLink({}, sharer);
    await db
      .delete(schema.userTable)
      .where(eq(schema.userTable.id, sharer.userId));
    const joiner = await ctx.person();
    expect((await ctx.join(joiner, token)).status).toBe(200);

    await vi.waitFor(() => expect(welcomesTo(joiner.userId)).toHaveLength(1));
    const [, text] = welcomesTo(joiner.userId)[0]!;
    expect(text).toBe(
      `*Welcome to Join Team on Baton!*\n<https://baton.test/dashboard/workspace/${ctx.workspace.id}/board|Open the board>`,
    );
  });
});
