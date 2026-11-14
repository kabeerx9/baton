import { eq, like } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

// The GitHub provider is built when auth.ts loads, so configure it first.
vi.hoisted(() => {
  process.env.GITHUB_OAUTH_CLIENT_ID = "test-github-client";
  process.env.GITHUB_OAUTH_CLIENT_SECRET = "test-github-secret";
});

const { default: db, schema } = await import("../../apps/api/src/database");
const { createApp } = await import("../../apps/api/src/index");
const { signUpWithSession } = await import("./helpers/auth-session");
const { resetTestDatabase } = await import("./helpers/database");

const GITHUB_ID = "424242";
const CALLBACK_URL = "http://localhost:5173/settings/account";
const jsonHeaders = {
  "content-type": "application/json",
  Origin: "http://localhost:5173",
};

function cookiesFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => pair && !pair.endsWith("="))
    .join("; ");
}

function sessionCookieSet(response: Response) {
  return response.headers
    .getSetCookie()
    .some((cookie) => /session_token=[^;]+/.test(cookie));
}

/** Answer GitHub's token and profile endpoints; pass everything else on. */
function stubGithub(email: string) {
  const realFetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith("https://github.com/login/oauth/access_token")) {
        return Response.json({
          access_token: "gho_test",
          token_type: "bearer",
          scope: "read:user,user:email",
        });
      }
      if (url === "https://api.github.com/user") {
        return Response.json({
          id: Number(GITHUB_ID),
          login: "octo",
          name: "Octo",
          email,
          avatar_url: "https://avatars.example/octo.png",
        });
      }
      if (url === "https://api.github.com/user/emails") {
        return Response.json([{ email, primary: true, verified: true }]);
      }
      return realFetch(input, init);
    }),
  );
}

async function verifiedUser(app: ReturnType<typeof createApp>["app"]) {
  const email = `member-${crypto.randomUUID()}@example.com`;
  const { userId, cookies } = await signUpWithSession(app, {
    email,
    name: "Member",
  });
  await db
    .update(schema.userTable)
    .set({ emailVerified: true })
    .where(eq(schema.userTable.id, userId));
  return { userId, cookies, email };
}

/** Start a real link flow and return its state and state cookie. */
async function startLink(
  app: ReturnType<typeof createApp>["app"],
  cookies: string,
) {
  const response = await app.request("/api/auth/link-social", {
    method: "POST",
    headers: { ...jsonHeaders, cookie: cookies },
    body: JSON.stringify({ provider: "github", callbackURL: CALLBACK_URL }),
  });
  expect(response.status).toBe(200);
  const { url } = (await response.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  expect(state).toBeTruthy();
  return { state: state as string, stateCookies: cookiesFrom(response) };
}

/** Turn a stored link state into the state a GitHub sign-in would carry. */
async function dropLinkFromState(state: string) {
  const [row] = await db
    .select()
    .from(schema.verificationTable)
    .where(eq(schema.verificationTable.identifier, `auth-state:${state}`));
  expect(row).toBeDefined();
  const { link: _link, ...signIn } = JSON.parse(row?.value ?? "{}");
  await db
    .update(schema.verificationTable)
    .set({ value: JSON.stringify(signIn) })
    .where(eq(schema.verificationTable.id, row?.id ?? ""));
}

function callback(
  app: ReturnType<typeof createApp>["app"],
  state: string,
  cookie: string,
) {
  return app.request(
    `/api/auth/callback/github?code=test-code&state=${encodeURIComponent(state)}`,
    { headers: { cookie } },
  );
}

async function sessionCount() {
  return (await db.select().from(schema.sessionTable)).length;
}

describe("GitHub is link-only", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refuses to start a GitHub sign-in", async () => {
    const { app } = createApp();
    const response = await app.request("/api/auth/sign-in/social", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ provider: "github", callbackURL: CALLBACK_URL }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "OAUTH_SIGN_IN_DISABLED",
    });
    const states = await db
      .select()
      .from(schema.verificationTable)
      .where(like(schema.verificationTable.identifier, "auth-state:%"));
    expect(states).toHaveLength(0);
  });

  it("refuses to start a GitHub sign-up", async () => {
    const { app } = createApp();
    const response = await app.request("/api/auth/sign-in/social", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        provider: "github",
        callbackURL: CALLBACK_URL,
        requestSignUp: true,
      }),
    });

    expect(response.status).toBe(403);
    expect(await db.select().from(schema.userTable)).toHaveLength(0);
  });

  it("creates no user or session from a sign-up callback", async () => {
    const { app } = createApp();
    const member = await verifiedUser(app);
    const { state, stateCookies } = await startLink(app, member.cookies);
    await dropLinkFromState(state);
    stubGithub("newcomer@example.com");
    const sessionsBefore = await sessionCount();

    const response = await callback(app, state, stateCookies);

    expect(response.status).toBe(403);
    expect(sessionCookieSet(response)).toBe(false);
    expect(await sessionCount()).toBe(sessionsBefore);
    const users = await db.select().from(schema.userTable);
    expect(users.map((user) => user.email)).toEqual([member.email]);
    expect(
      await db
        .select()
        .from(schema.accountTable)
        .where(eq(schema.accountTable.providerId, "github")),
    ).toHaveLength(0);
  });

  it("refuses a sign-in callback that would link a user with the same verified email", async () => {
    const { app } = createApp();
    const member = await verifiedUser(app);
    const { state, stateCookies } = await startLink(app, member.cookies);
    await dropLinkFromState(state);
    stubGithub(member.email);
    const sessionsBefore = await sessionCount();

    const response = await callback(app, state, stateCookies);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "OAUTH_SIGN_IN_DISABLED",
    });
    expect(sessionCookieSet(response)).toBe(false);
    expect(await sessionCount()).toBe(sessionsBefore);
    expect(
      await db
        .select()
        .from(schema.accountTable)
        .where(eq(schema.accountTable.providerId, "github")),
    ).toHaveLength(0);
  });

  it("refuses a sign-in callback for a linked account without refreshing it", async () => {
    const { app } = createApp();
    const member = await verifiedUser(app);
    const linkedAt = new Date("2026-01-01T00:00:00.000Z");
    await db.insert(schema.accountTable).values({
      userId: member.userId,
      providerId: "github",
      accountId: GITHUB_ID,
      accessToken: "gho_stored",
      createdAt: linkedAt,
      updatedAt: linkedAt,
    });
    const { state, stateCookies } = await startLink(app, member.cookies);
    await dropLinkFromState(state);
    stubGithub(member.email);
    const sessionsBefore = await sessionCount();

    const response = await callback(app, state, stateCookies);

    expect(response.status).toBe(403);
    expect(sessionCookieSet(response)).toBe(false);
    expect(await sessionCount()).toBe(sessionsBefore);
    expect(
      await db
        .select()
        .from(schema.accountTable)
        .where(eq(schema.accountTable.providerId, "github")),
    ).toMatchObject([{ accessToken: "gho_stored", updatedAt: linkedAt }]);
  });

  it("refuses a callback whose state is unknown", async () => {
    const { app } = createApp();
    stubGithub("someone@example.com");

    const response = await callback(app, "missing-state", "");

    expect(response.status).toBe(403);
    expect(await db.select().from(schema.accountTable)).toHaveLength(0);
  });

  it("links GitHub to a signed-in user without starting a session", async () => {
    const { app } = createApp();
    const member = await verifiedUser(app);
    const { state, stateCookies } = await startLink(app, member.cookies);
    stubGithub("octo-personal@example.com");
    const sessionsBefore = await sessionCount();

    const response = await callback(
      app,
      state,
      `${member.cookies}; ${stateCookies}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(CALLBACK_URL);
    const accounts = await db
      .select()
      .from(schema.accountTable)
      .where(eq(schema.accountTable.providerId, "github"));
    expect(accounts).toMatchObject([
      { userId: member.userId, accountId: GITHUB_ID },
    ]);
    expect(sessionCookieSet(response)).toBe(false);
    expect(await sessionCount()).toBe(sessionsBefore);
  });

  it("refuses to start a link without a session", async () => {
    const { app } = createApp();
    const response = await app.request("/api/auth/link-social", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ provider: "github", callbackURL: CALLBACK_URL }),
    });

    expect(response.status).toBe(401);
    const states = await db
      .select()
      .from(schema.verificationTable)
      .where(like(schema.verificationTable.identifier, "auth-state:%"));
    expect(states).toHaveLength(0);
  });
});
