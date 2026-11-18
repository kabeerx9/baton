import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../database";
import { readStoredSettings } from "../instance-settings/read-stored-settings";
import type { IdentityProvider } from "./port";

export type SignedIn = { userId: string; headers: Headers; sessionId: string };

/** What the suite needs to put an adapter into each state. */
export type ContractDriver = {
  adapter: IdentityProvider;
  /** A new user with a password and one session; runs `userCreated`. */
  signUp(email: string): Promise<SignedIn>;
  /** Another session for the same user. */
  signIn(user: SignedIn, email: string): Promise<SignedIn>;
  expireSession(sessionId: string): Promise<void>;
  setLastActive(sessionId: string, at: Date): Promise<void>;
  changePassword(user: SignedIn): Promise<void>;
  linkGithub(userId: string, accountId: string): Promise<void>;
  linkExpiresAt(link: string): Promise<Date>;
};

class Rollback extends Error {}

async function rolledBack(
  work: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) => Promise<void>,
) {
  await expect(
    db.transaction(async (tx) => {
      await work(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
}

function lockUser(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
) {
  return tx
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .for("update");
}

/** The identity port's contract. Every adapter runs it (record §3, P2 A1). */
export function describeIdentityContract(
  name: string,
  setup: () => Promise<ContractDriver>,
) {
  describe(`identity contract: ${name}`, () => {
    let driver: ContractDriver;
    let identity: IdentityProvider;
    beforeEach(async () => {
      driver = await setup();
      identity = driver.adapter;
    });

    describe("resolve", () => {
      it("answers a valid session with the person", async () => {
        const user = await driver.signUp("valid@example.com");
        const caller = await identity.resolve(user.headers);
        const [stored] = await db
          .select({ role: schema.userTable.role })
          .from(schema.userTable)
          .where(eq(schema.userTable.id, user.userId));
        expect(caller).toEqual({
          identity: {
            userId: user.userId,
            subject: user.userId,
            email: "valid@example.com",
            name: "valid@example.com",
            emailVerified: false,
          },
          sessionId: user.sessionId,
          instanceRole: stored?.role ?? null,
        });
      });

      it("answers null for an expired, an ended or a garbage credential", async () => {
        const expired = await driver.signUp("expired@example.com");
        await driver.expireSession(expired.sessionId);
        expect(await identity.resolve(expired.headers)).toBeNull();

        const ended = await driver.signUp("ended@example.com");
        await db.transaction(async (tx) => {
          await lockUser(tx, ended.userId);
          await identity.fence.endSessions(tx, ended.userId, {
            ids: [ended.sessionId],
          });
        });
        expect(await identity.resolve(ended.headers)).toBeNull();

        for (const headers of [
          new Headers(),
          new Headers({ authorization: "Bearer not-a-session" }),
          new Headers({ cookie: "a=b; c=d" }),
        ])
          expect(await identity.resolve(headers)).toBeNull();
      });

      it("refuses a banned user who still has a session", async () => {
        const user = await driver.signUp("banned@example.com");
        await db
          .update(schema.userTable)
          .set({ banned: true })
          .where(eq(schema.userTable.id, user.userId));
        expect(await identity.resolve(user.headers)).toBeNull();
      });
    });

    describe("sessions", () => {
      it("lists unexpired sessions by last activity, newest first", async () => {
        const first = await driver.signUp("list@example.com");
        const second = await driver.signIn(first, "list@example.com");
        const third = await driver.signIn(first, "list@example.com");
        await driver.setLastActive(
          first.sessionId,
          new Date(Date.now() + 60_000),
        );
        await driver.setLastActive(
          second.sessionId,
          new Date(Date.now() - 60_000),
        );
        await driver.expireSession(third.sessionId);

        const listed = await identity.sessions.list(first.userId);
        expect(listed.map((session) => session.id)).toEqual([
          first.sessionId,
          second.sessionId,
        ]);
        for (const session of listed) {
          expect(session.updatedAt).toBeInstanceOf(Date);
          expect(session.createdAt).toBeInstanceOf(Date);
          expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
        }
      });

      it("reports which sessions still exist", async () => {
        const user = await driver.signUp("existing@example.com");
        const other = await driver.signIn(user, "existing@example.com");
        await db.transaction(async (tx) => {
          await lockUser(tx, user.userId);
          await identity.fence.endSessions(tx, user.userId, {
            ids: [other.sessionId],
          });
        });
        expect(
          await identity.sessions.existing([
            user.sessionId,
            other.sessionId,
            "never-existed",
          ]),
        ).toEqual(new Set([user.sessionId]));
        expect(await identity.sessions.existing([])).toEqual(new Set());
      });

      it("counts recently active users who are not banned", async () => {
        const active = await driver.signUp("active@example.com");
        const banned = await driver.signUp("inactive-ban@example.com");
        const idle = await driver.signUp("idle@example.com");
        await driver.setLastActive(idle.sessionId, new Date("2020-01-01"));
        await db
          .update(schema.userTable)
          .set({ banned: true })
          .where(eq(schema.userTable.id, banned.userId));
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        expect(await identity.sessions.countActiveUsers(since)).toBe(1);
        expect(active.userId).toBeTruthy();
      });
    });

    describe("fence", () => {
      it("ends sessions by id and returns the ended ids", async () => {
        const user = await driver.signUp("by-id@example.com");
        const other = await driver.signIn(user, "by-id@example.com");
        const ended = await db.transaction(async (tx) => {
          await lockUser(tx, user.userId);
          return identity.fence.endSessions(tx, user.userId, {
            ids: [other.sessionId, "not-this-users"],
          });
        });
        expect(ended).toEqual([other.sessionId]);
        expect(await identity.resolve(other.headers)).toBeNull();
        expect(await identity.resolve(user.headers)).not.toBeNull();
      });

      it("ends all sessions but one, or all", async () => {
        const user = await driver.signUp("all@example.com");
        const second = await driver.signIn(user, "all@example.com");
        const third = await driver.signIn(user, "all@example.com");
        const allButOne = await db.transaction(async (tx) => {
          await lockUser(tx, user.userId);
          return identity.fence.endSessions(tx, user.userId, {
            allExcept: user.sessionId,
          });
        });
        expect(new Set(allButOne)).toEqual(
          new Set([second.sessionId, third.sessionId]),
        );
        const rest = await db.transaction(async (tx) => {
          await lockUser(tx, user.userId);
          return identity.fence.endSessions(tx, user.userId, {
            allExcept: null,
          });
        });
        expect(rest).toEqual([user.sessionId]);
        expect(await identity.sessions.list(user.userId)).toEqual([]);
      });

      it("rolls a session end back with its transaction", async () => {
        const user = await driver.signUp("rollback@example.com");
        await rolledBack(async (tx) => {
          await lockUser(tx, user.userId);
          expect(
            await identity.fence.endSessions(tx, user.userId, {
              allExcept: null,
            }),
          ).toEqual([user.sessionId]);
          // Inside the transaction the end is visible.
          expect(
            await identity.fence.sessionIsLive(tx, {
              userId: user.userId,
              sessionId: user.sessionId,
            }),
          ).toBe(false);
        });
        expect(await identity.resolve(user.headers)).not.toBeNull();
        expect(await identity.sessions.existing([user.sessionId])).toEqual(
          new Set([user.sessionId]),
        );
      });

      it("says whether a session is live for its own user", async () => {
        const user = await driver.signUp("live@example.com");
        const other = await driver.signUp("other-live@example.com");
        await db.transaction(async (tx) => {
          await lockUser(tx, user.userId);
          expect(
            await identity.fence.sessionIsLive(tx, {
              userId: user.userId,
              sessionId: user.sessionId,
            }),
          ).toBe(true);
          expect(
            await identity.fence.sessionIsLive(tx, {
              userId: other.userId,
              sessionId: user.sessionId,
            }),
          ).toBe(false);
        });
        await driver.expireSession(user.sessionId);
        expect(
          await identity.fence.sessionIsLive(db, {
            userId: user.userId,
            sessionId: user.sessionId,
          }),
        ).toBe(false);
      });

      it("moves the credential generation on every password change, null without a password", async () => {
        const user = await driver.signUp("generation@example.com");
        const seen = [
          await identity.fence.credentialGeneration(db, user.userId),
        ];
        expect(seen[0]).toEqual(expect.any(Number));
        for (let change = 0; change < 2; change += 1) {
          await driver.changePassword(user);
          seen.push(await identity.fence.credentialGeneration(db, user.userId));
        }
        expect(new Set(seen).size).toBe(3);

        const passwordless = await db.transaction((tx) =>
          identity.users.create(tx, {
            name: "No password",
            email: "no-password@example.com",
          }),
        );
        expect(
          await identity.fence.credentialGeneration(db, passwordless!.userId),
        ).toBeNull();
      });

      it("removes a user and their sessions", async () => {
        const user = await driver.signUp("remove@example.com");
        await db.transaction(async (tx) => {
          await lockUser(tx, user.userId);
          await identity.fence.removeUser(tx, user.userId);
        });
        expect(await identity.resolve(user.headers)).toBeNull();
        expect(await identity.sessions.existing([user.sessionId])).toEqual(
          new Set(),
        );
        expect(
          await db
            .select()
            .from(schema.userTable)
            .where(eq(schema.userTable.id, user.userId)),
        ).toEqual([]);
      });
    });

    describe("users", () => {
      it("creates a user, and answers null for a taken email in any case", async () => {
        const created = await db.transaction((tx) =>
          identity.users.create(tx, {
            name: "Created",
            email: "created@example.com",
          }),
        );
        expect(created).toEqual({ userId: expect.any(String) });
        const taken = await db.transaction((tx) =>
          identity.users.create(tx, {
            name: "Again",
            email: "Created@Example.com",
          }),
        );
        expect(taken).toBeNull();
      });

      it("updates identity fields and rolls the update back with its transaction", async () => {
        const user = await driver.signUp("update@example.com");
        await rolledBack(async (tx) => {
          await identity.users.update(tx, user.userId, { name: "Never" });
        });
        await db.transaction((tx) =>
          identity.users.update(tx, user.userId, {
            email: "updated@example.com",
            emailVerified: true,
          }),
        );
        const [row] = await db
          .select({
            name: schema.userTable.name,
            email: schema.userTable.email,
            emailVerified: schema.userTable.emailVerified,
          })
          .from(schema.userTable)
          .where(eq(schema.userTable.id, user.userId));
        expect(row).toEqual({
          name: "update@example.com",
          email: "updated@example.com",
          emailVerified: true,
        });
      });
    });

    describe("hooks", () => {
      it("userCreated promotes the first user and gives later ones the default role", async () => {
        // A custom default, so the provider's own "user" default cannot pass.
        const [role] = await db
          .insert(schema.instanceRoleTable)
          .values({ name: "contractor", permissions: [] })
          .returning({ id: schema.instanceRoleTable.id });
        await db
          .insert(schema.instanceSettingsTable)
          .values({ id: "instance", defaultRoleId: role!.id })
          .onConflictDoUpdate({
            target: schema.instanceSettingsTable.id,
            set: { defaultRoleId: role!.id },
          });
        const first = await driver.signUp("first@example.com");
        const second = await driver.signUp("second@example.com");
        const roles = await db
          .select({ id: schema.userTable.id, role: schema.userTable.role })
          .from(schema.userTable);
        const roleOf = (id: string) => roles.find((row) => row.id === id)?.role;
        expect(roleOf(first.userId)).toBe("admin");
        expect((await readStoredSettings()).defaultRole).toBe("contractor");
        expect(roleOf(second.userId)).toBe("contractor");
      });
    });

    describe("credentials and accounts", () => {
      it("gives setup links two days and reset links one hour", async () => {
        const user = await driver.signUp("links@example.com");
        const hours = async (purpose: "setup" | "reset") => {
          const link = await identity.credentials.passwordSetupLink(
            user.userId,
            purpose,
          );
          return (
            ((await driver.linkExpiresAt(link)).getTime() - Date.now()) /
            3_600_000
          );
        };
        expect(await hours("setup")).toBeCloseTo(48, 0);
        expect(await hours("reset")).toBeCloseTo(1, 0);
        expect(
          await identity.credentials.emailVerificationLink(user.userId),
        ).toEqual(expect.any(String));
      });

      it("reads a linked GitHub account", async () => {
        const user = await driver.signUp("github@example.com");
        expect(await identity.linkedAccount(user.userId, "github")).toBeNull();
        await driver.linkGithub(user.userId, "12345");
        expect(await identity.linkedAccount(user.userId, "github")).toEqual({
          accountId: "12345",
        });
      });
    });
  });
}
