import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { slackUserLinkTable } from "../../apps/api/src/database/schema";
import { claimDigest } from "../../apps/api/src/slack-dm/claim-digest";
import { sendDueDigests } from "../../apps/api/src/slack-dm/digest";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";

// Slack itself is the only fake: every user is found by email, and posts are
// recorded by Slack user id (`S-<user id>`).
const slack = vi.hoisted(() => ({
  post: vi.fn(async () => ({ kind: "sent" as const })),
}));
vi.mock("../../apps/api/src/slack-dm/slack-api", () => ({
  lookupSlackUserByEmail: async (_token: string, email: string) => ({
    kind: "found",
    slackUserId: `S-${email.split("@")[0]}`,
  }),
  postSlackDm: slack.post,
}));

// Runs just before each claim, to change state between selection and claim.
const claimHook = vi.hoisted(() => ({
  before: null as null | (() => Promise<void>),
}));
vi.mock("../../apps/api/src/slack-dm/claim-digest", async (importOriginal) => {
  const real =
    await importOriginal<
      typeof import("../../apps/api/src/slack-dm/claim-digest")
    >();
  return {
    claimDigest: async (...args: Parameters<typeof real.claimDigest>) => {
      await claimHook.before?.();
      return real.claimDigest(...args);
    },
  };
});

beforeEach(async () => {
  await resetTestDatabase();
  claimHook.before = null;
  slack.post.mockClear();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("BATON_CLIENT_URL", "https://baton.test");
  vi.stubEnv("SLACK_DIGEST_TIME", "10:00");
  vi.stubEnv("SLACK_DIGEST_TZ", "Europe/London");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// 2026-11-18 is a Wednesday.
const at = (iso: string) => new Date(iso);

async function user(timeZone: string | null) {
  const id = `user-${randomUUID()}`;
  await db
    .insert(schema.userTable)
    .values({ id, name: "Owner", email: `${id}@example.com`, timeZone });
  return id;
}

/** An owner in `timeZone` whose open task blocks a teammate's open task. */
async function blocker(
  timeZone: string | null,
  kind: "team" | "demo" = "team",
) {
  const ownerId = await user(timeZone);
  const waiterId = await user(null);
  const workspaceId = `workspace-${randomUUID()}`;
  await db.insert(schema.workspaceTable).values({
    id: workspaceId,
    name: "Team",
    slug: workspaceId,
    createdAt: new Date(),
    kind,
    demoOwnerUserId: kind === "demo" ? ownerId : null,
  });
  const { project } = await createProjectFixture({ workspaceId });
  const [blocking, blocked] = await db
    .insert(schema.taskTable)
    .values([
      { projectId: project.id, title: "Blocker", userId: ownerId, number: 1 },
      { projectId: project.id, title: "Blocked", userId: waiterId, number: 2 },
    ])
    .returning();
  await db.insert(schema.taskRelationTable).values({
    sourceTaskId: blocking!.id,
    targetTaskId: blocked!.id,
    relationType: "blocks",
  });
  return ownerId;
}

function digestsTo(userId: string) {
  return slack.post.mock.calls.filter(
    (call) => (call as unknown[])[1] === `S-${userId}`,
  );
}

async function linkRow(userId: string) {
  const [row] = await db
    .select()
    .from(slackUserLinkTable)
    .where(eq(slackUserLinkTable.userId, userId));
  return row;
}

describe("the per-user Slack digest", () => {
  it("sends at 10:00 in Kolkata (+5:30), not before", async () => {
    const owner = await blocker("Asia/Kolkata");

    await sendDueDigests(at("2026-11-18T04:15:00Z"));
    expect(digestsTo(owner)).toHaveLength(0);

    await sendDueDigests(at("2026-11-18T04:30:00Z"));
    expect(digestsTo(owner)).toHaveLength(1);
    expect(String(digestsTo(owner)[0]![2])).toContain("Waiting on you: 1 task");
    expect((await linkRow(owner))?.lastDigestDay).toBe("2026-11-18");
  });

  it("sends at 10:00 in Kathmandu (+5:45)", async () => {
    const owner = await blocker("Asia/Kathmandu");
    await sendDueDigests(at("2026-11-18T04:15:00Z"));
    expect(digestsTo(owner)).toHaveLength(1);
  });

  it("sends to a person without a zone at 10:00 in SLACK_DIGEST_TZ", async () => {
    const owner = await blocker(null);
    await sendDueDigests(at("2026-11-18T04:30:00Z"));
    expect(digestsTo(owner)).toHaveLength(0);
    await sendDueDigests(at("2026-11-18T10:00:00Z"));
    expect(digestsTo(owner)).toHaveLength(1);
  });

  it("uses SLACK_DIGEST_TZ for a stored zone that is no longer valid", async () => {
    const owner = await blocker("IST");
    await sendDueDigests(at("2026-11-18T10:00:00Z"));
    expect(digestsTo(owner)).toHaveLength(1);
  });

  it("skips an owner whose zone is not due, although they block", async () => {
    const kolkata = await blocker("Asia/Kolkata");
    const nullZone = await blocker(null);
    await sendDueDigests(at("2026-11-18T10:00:00Z"));
    expect(digestsTo(nullZone)).toHaveLength(1);
    expect(digestsTo(kolkata)).toHaveLength(0);
    expect(await linkRow(kolkata)).toBeUndefined();
  });

  it("sends once across two runs in a tick and the next tick (restart dedupe)", async () => {
    const owner = await blocker("Asia/Kolkata");
    await sendDueDigests(at("2026-11-18T04:30:00Z"));
    await sendDueDigests(at("2026-11-18T04:30:00Z"));
    await sendDueDigests(at("2026-11-18T04:45:00Z"));
    expect(digestsTo(owner)).toHaveLength(1);
  });

  it("sends nothing when a zone change moves the local day backwards", async () => {
    const owner = await blocker("Pacific/Kiritimati");
    // 10:00 Thursday 2026-11-19 in Kiritimati (+14).
    await sendDueDigests(at("2026-11-18T20:00:00Z"));
    expect(digestsTo(owner)).toHaveLength(1);

    await db
      .update(schema.userTable)
      .set({ timeZone: "Pacific/Pago_Pago" })
      .where(eq(schema.userTable.id, owner));
    // An hour later it is 10:00 Wednesday 2026-11-18 in Pago Pago (-11).
    await sendDueDigests(at("2026-11-18T21:00:00Z"));
    expect(digestsTo(owner)).toHaveLength(1);
    expect((await linkRow(owner))?.lastDigestDay).toBe("2026-11-19");
  });

  it("sends nothing on a local Saturday", async () => {
    const owner = await blocker("Asia/Kolkata");
    await sendDueDigests(at("2026-11-21T04:30:00Z"));
    expect(digestsTo(owner)).toHaveLength(0);
  });

  it("gives a person who blocks nothing no slack_user_link row", async () => {
    const idle = await user("Asia/Kolkata");
    await blocker("Asia/Kolkata");
    await sendDueDigests(at("2026-11-18T04:30:00Z"));
    expect(await linkRow(idle)).toBeUndefined();
    expect(digestsTo(idle)).toHaveLength(0);
  });

  it("never lists a demo workspace", async () => {
    const owner = await blocker("Asia/Kolkata", "demo");
    await sendDueDigests(at("2026-11-18T04:30:00Z"));
    expect(digestsTo(owner)).toHaveLength(0);
    expect(slack.post).not.toHaveBeenCalled();
  });

  it("runs no query without a bot token", async () => {
    await blocker("Asia/Kolkata");
    vi.stubEnv("SLACK_BOT_TOKEN", "");
    const query = vi.spyOn(getDatabasePool(), "query");

    expect(await sendDueDigests(at("2026-11-18T04:30:00Z"))).toEqual({
      sent: 0,
    });
    expect(query).not.toHaveBeenCalled();
    expect(slack.post).not.toHaveBeenCalled();

    // The spy sees the job's queries once a token is set.
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    await sendDueDigests(at("2026-11-18T04:30:00Z"));
    expect(query).toHaveBeenCalled();
  });

  it("skips a claim when the zone changed after the tick read it (date-line race)", async () => {
    const owner = await blocker("Pacific/Honolulu");
    // 20:00Z is 10:00 Wednesday 2026-11-18 in Honolulu (-10) and
    // 10:00 Thursday 2026-11-19 in Kiritimati (+14).
    claimHook.before = async () => {
      claimHook.before = null;
      await db
        .update(schema.userTable)
        .set({ timeZone: "Pacific/Kiritimati" })
        .where(eq(schema.userTable.id, owner));
    };
    await sendDueDigests(at("2026-11-18T20:00:00Z"));
    expect(digestsTo(owner)).toHaveLength(0);

    await sendDueDigests(at("2026-11-18T20:15:00Z"));
    expect(digestsTo(owner)).toHaveLength(1);
    expect((await linkRow(owner))?.lastDigestDay).toBe("2026-11-19");
  });

  // The selection already skips claimed owners; the claim is what stops two
  // servers that select the same owner in one tick.
  it("claims a day only when it is later than the last one claimed", async () => {
    const owner = await user("Asia/Kolkata");
    const zone = "Asia/Kolkata";
    expect(await claimDigest(owner, "2026-11-18", zone)).toBe(true);
    expect(await claimDigest(owner, "2026-11-18", zone)).toBe(false);
    expect(await claimDigest(owner, "2026-11-17", zone)).toBe(false);
    expect((await linkRow(owner))?.lastDigestDay).toBe("2026-11-18");
    expect(await claimDigest(owner, "2026-11-19", zone)).toBe(true);
  });

  it("lets exactly one of two concurrent claims win", async () => {
    const owner = await user(null);
    const results = await Promise.all([
      claimDigest(owner, "2026-11-18", null),
      claimDigest(owner, "2026-11-18", null),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("refuses a claim computed with a zone the user no longer has", async () => {
    const owner = await user("Asia/Kolkata");
    expect(await claimDigest(owner, "2026-11-18", null)).toBe(false);
    expect(await claimDigest(owner, "2026-11-18", "Asia/Kathmandu")).toBe(
      false,
    );
    expect(await linkRow(owner)).toBeUndefined();
    expect(await claimDigest(owner, "2026-11-18", "Asia/Kolkata")).toBe(true);
  });

  it("claims a day for a person whose Slack link has no digest yet", async () => {
    const owner = await user(null);
    await db.insert(slackUserLinkTable).values({ userId: owner });
    expect(await claimDigest(owner, "2026-11-18", null)).toBe(true);
  });
});
