import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { batonIdentityHooks } from "../../apps/api/src/identity/baton-hooks";
import { createBetterAuthIdentity } from "../../apps/api/src/identity/better-auth/adapter";
import { auth } from "../../apps/api/src/identity/better-auth/auth";
import {
  type ContractDriver,
  describeIdentityContract,
  type SignedIn,
} from "../../apps/api/src/identity/contract.test-suite";
import { createFakeIdentity } from "../../apps/api/src/identity/fake";
import { resetTestDatabase } from "./helpers/database";

beforeEach(async () => {
  await resetTestDatabase();
});

const API = "http://localhost:1337/api/auth";

function cookiesOf(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => pair && !pair.endsWith("="))
    .join("; ");
}

async function setSession(
  sessionId: string,
  set: { expiresAt?: Date; updatedAt?: Date },
) {
  await db
    .update(schema.sessionTable)
    .set(set)
    .where(eq(schema.sessionTable.id, sessionId));
}

function betterAuthDriver(): ContractDriver {
  const adapter = createBetterAuthIdentity(auth, batonIdentityHooks);
  const passwords = new Map<string, string>();
  async function signedIn(response: Response): Promise<SignedIn> {
    if (response.status !== 200)
      throw new Error(
        `Auth call failed: ${response.status} ${await response.text()}`,
      );
    const headers = new Headers({ cookie: cookiesOf(response) });
    const caller = await adapter.resolve(headers);
    if (!caller) throw new Error("No session after sign-in");
    return {
      userId: caller.identity.userId,
      headers,
      sessionId: caller.sessionId,
    };
  }
  const post = (path: string, body: unknown, headers?: Headers) =>
    adapter.handle(
      new Request(`${API}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...Object.fromEntries(headers ?? []),
        },
        body: JSON.stringify(body),
      }),
    );
  return {
    adapter,
    async signUp(email) {
      const password = "a-long-password-1";
      const user = await signedIn(
        await post("/sign-up/email", { email, name: email, password }),
      );
      passwords.set(user.userId, password);
      return user;
    },
    async signIn(user, email) {
      return signedIn(
        await post("/sign-in/email", {
          email,
          password: passwords.get(user.userId),
        }),
      );
    },
    expireSession: (id) =>
      setSession(id, { expiresAt: new Date(Date.now() - 1000) }),
    setLastActive: (id, at) => setSession(id, { updatedAt: at }),
    async changePassword(user) {
      const next = `changed-${randomUUID()}`;
      const response = await post(
        "/change-password",
        { currentPassword: passwords.get(user.userId), newPassword: next },
        user.headers,
      );
      if (response.status !== 200)
        throw new Error(
          `change-password: ${response.status} ${await response.text()}`,
        );
      passwords.set(user.userId, next);
    },
    async linkGithub(userId, accountId) {
      await db.insert(schema.accountTable).values({
        id: randomUUID(),
        accountId,
        providerId: "github",
        userId,
        updatedAt: new Date(),
      });
    },
    async linkExpiresAt(link) {
      const token = link.match(/\/reset-password\/([^?]+)/)?.[1];
      const [row] = await db
        .select({ expiresAt: schema.verificationTable.expiresAt })
        .from(schema.verificationTable)
        .where(
          eq(schema.verificationTable.identifier, `reset-password:${token}`),
        );
      if (!row) throw new Error("No verification row for link");
      return row.expiresAt;
    },
  };
}

function fakeDriver(): ContractDriver {
  const fake = createFakeIdentity({ hooks: batonIdentityHooks });
  function session(userId: string): SignedIn {
    const created = fake.addSession(userId);
    return {
      userId,
      headers: fake.headersFor(created.token),
      sessionId: created.id,
    };
  }
  return {
    adapter: fake,
    async signUp(email) {
      const created = await db.transaction((tx) =>
        fake.users.create(tx, { name: email, email }),
      );
      if (!created) throw new Error("Email taken");
      await batonIdentityHooks.userCreated({
        userId: created.userId,
        subject: created.userId,
        email,
        name: email,
        emailVerified: false,
      });
      fake.changePassword(created.userId);
      return session(created.userId);
    },
    signIn: async (user) => session(user.userId),
    expireSession: async (id) =>
      fake.updateSession(id, { expiresAt: new Date(Date.now() - 1000) }),
    setLastActive: async (id, at) => fake.updateSession(id, { updatedAt: at }),
    changePassword: async (user) => fake.changePassword(user.userId),
    linkGithub: async (userId, accountId) =>
      fake.linkAccount(userId, accountId),
    async linkExpiresAt(link) {
      const at = fake.linkExpiresAt(link);
      if (!at) throw new Error("Unknown link");
      return at;
    },
  };
}

describeIdentityContract("better-auth", async () => betterAuthDriver());
describeIdentityContract("fake", async () => fakeDriver());
