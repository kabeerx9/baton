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
import {
  slackUserLinkTable,
  workspaceJoinLinkTable,
} from "../../apps/api/src/database/schema";
import { publishEvent } from "../../apps/api/src/events";
import { resetJoinLinkRateLimits } from "../../apps/api/src/join-link/rate-limit";
import { resetTestDatabase } from "./helpers/database";
import { joinLinkFixture } from "./helpers/join-link";

// Slack itself is the only fake, so the real sendDm resolves each person.
// Everyone is found by email except addresses that start with "no-slack".
const slack = vi.hoisted(() => ({
  post: vi.fn(async () => ({ kind: "sent" as const })),
}));
vi.mock("../../apps/api/src/slack-dm/slack-api", () => ({
  lookupSlackUserByEmail: async (_token: string, email: string) =>
    email.startsWith("no-slack")
      ? { kind: "not_found" }
      : { kind: "found", slackUserId: `S-${email}` },
  postSlackDm: slack.post,
}));

beforeEach(async () => {
  await resetTestDatabase();
  resetJoinLinkRateLimits();
  slack.post.mockClear();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("BATON_CLIENT_URL", "https://baton.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

async function emailOf(userId: string) {
  const [row] = await db
    .select({ email: schema.userTable.email })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return row!.email;
}

async function welcomesTo(userId: string) {
  const slackId = `S-${await emailOf(userId)}`;
  return slack.post.mock.calls
    .filter((call) => (call as unknown[])[1] === slackId)
    .map((call) => (call as unknown[])[2] as string);
}

const board = (workspaceId: string) =>
  `<https://baton.test/dashboard/workspace/${workspaceId}/board>`;

describe("Slack welcome on join", () => {
  it("sends one welcome naming the workspace, the sharer and the board", async () => {
    const ctx = await joinLinkFixture();
    const sharer = await ctx.person("Kabeer");
    await ctx.addMember(sharer, "admin");
    const { token } = await ctx.createLink({}, sharer);
    const joiner = await ctx.person();
    expect((await ctx.join(joiner, token)).status).toBe(200);

    await vi.waitFor(async () =>
      expect(await welcomesTo(joiner.userId)).toHaveLength(1),
    );
    await settle();
    expect(await welcomesTo(joiner.userId)).toEqual([
      `Welcome to *Join Team* on Baton! Kabeer shared this workspace with you. Open your board: ${board(ctx.workspace.id)}`,
    ]);
    expect(slack.post).toHaveBeenCalledTimes(1);
  });

  it("names the workspace owner when the sharer's account is gone", async () => {
    const ctx = await joinLinkFixture();
    const sharer = await ctx.person("Sharing Admin");
    await ctx.addMember(sharer, "admin");
    const { token } = await ctx.createLink({}, sharer);
    await db
      .delete(schema.userTable)
      .where(eq(schema.userTable.id, sharer.userId));
    const joiner = await ctx.person();
    expect((await ctx.join(joiner, token)).status).toBe(200);

    await vi.waitFor(async () =>
      expect(await welcomesTo(joiner.userId)).toEqual([
        `Welcome to *Join Team* on Baton! Owner Person shared this workspace with you. Open your board: ${board(ctx.workspace.id)}`,
      ]),
    );
  });

  it("leaves out the sharer when neither the sharer nor an owner is left", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const joiner = await ctx.person();
    expect((await ctx.join(joiner, token)).status).toBe(200);
    await settle();
    slack.post.mockClear();
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "admin" })
      .where(eq(schema.workspaceUserTable.workspaceId, ctx.workspace.id));
    await db
      .update(workspaceJoinLinkTable)
      .set({ createdBy: null })
      .where(eq(workspaceJoinLinkTable.workspaceId, ctx.workspace.id));
    const [link] = await db
      .select({ id: workspaceJoinLinkTable.id })
      .from(workspaceJoinLinkTable)
      .where(eq(workspaceJoinLinkTable.workspaceId, ctx.workspace.id));

    await publishEvent(
      "workspace.member_joined",
      {
        workspaceId: ctx.workspace.id,
        userId: joiner.userId,
        linkId: link!.id,
      },
      { waitForHandlers: true },
    );

    expect(await welcomesTo(joiner.userId)).toEqual([
      `Welcome to *Join Team* on Baton! Open your board: ${board(ctx.workspace.id)}`,
    ]);
  });

  it("sends nothing to a person who is already a member", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const response = await ctx.join(ctx.owner, token);
    expect(await response.json()).toMatchObject({ outcome: "already_member" });
    await settle();
    expect(slack.post).not.toHaveBeenCalled();
  });

  it("sends nothing to the person who shared the link", async () => {
    const ctx = await joinLinkFixture();
    const { link } = await ctx.createLink();

    await publishEvent(
      "workspace.member_joined",
      {
        workspaceId: ctx.workspace.id,
        userId: ctx.owner.userId,
        linkId: link.id,
      },
      { waitForHandlers: true },
    );
    await settle();

    expect(slack.post).not.toHaveBeenCalled();
  });

  it("sends nothing without a Slack token", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "");
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    expect((await ctx.join(await ctx.person(), token)).status).toBe(200);
    await settle();
    expect(slack.post).not.toHaveBeenCalled();
  });

  it("sends nothing to a joiner with no Slack account", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const joiner = await ctx.person("No Slack");
    expect((await ctx.join(joiner, token)).status).toBe(200);

    await vi.waitFor(async () => {
      const [row] = await db
        .select({ checkedAt: slackUserLinkTable.checkedAt })
        .from(slackUserLinkTable)
        .where(eq(slackUserLinkTable.userId, joiner.userId));
      expect(row?.checkedAt).toBeInstanceOf(Date);
    });
    await settle();
    expect(slack.post).not.toHaveBeenCalled();
  });
});
