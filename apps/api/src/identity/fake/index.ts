import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import db, { schema } from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { notBannedCondition } from "../../utils/user-ban";
import type {
  Caller,
  IdentityHooks,
  IdentityProvider,
  PasswordLinkPurpose,
} from "../port";
import { userRows } from "../user-rows";

/** The cookie the fake reads; a bearer token works too. */
export const FAKE_SESSION_COOKIE = "fake_session";

const LINK_SECONDS: Record<PasswordLinkPurpose, number> = {
  setup: 2 * 24 * 60 * 60,
  reset: 60 * 60,
};

type FakeSession = {
  id: string;
  userId: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

/** Session ends made inside a caller's transaction, settled once it commits. */
type PendingEnd = { txid: string; sessionIds: string[] };

export type FakeIdentityOptions = {
  hooks: IdentityHooks;
  /** Answer every `resolve` with this caller, whatever the headers. */
  signedInAs?: Caller;
  /** The provider's HTTP surface; 404 when absent. */
  handle?: (request: Request) => Promise<Response>;
};

export type FakeIdentity = IdentityProvider & {
  addSession(
    userId: string,
    input?: Partial<Omit<FakeSession, "userId">>,
  ): FakeSession;
  updateSession(
    sessionId: string,
    patch: Partial<Pick<FakeSession, "expiresAt" | "updatedAt">>,
  ): void;
  /** Set or change the password: the credential generation moves on. */
  changePassword(userId: string): void;
  linkAccount(userId: string, accountId: string): void;
  linkExpiresAt(link: string): Date | undefined;
  headersFor(token: string): Headers;
};

function readToken(headers: Headers) {
  const bearer = headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (bearer) return bearer;
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === FAKE_SESSION_COOKIE) return value.join("=");
  }
  return null;
}

async function currentTxid(tx: DbOrTx) {
  const result = await tx.execute<{ txid: string }>(
    sql`select txid_current()::text as txid`,
  );
  return result.rows[0]!.txid;
}

/**
 * An in-memory identity provider for tests. Its users are Baton's `user`
 * rows; its sessions, passwords and links live here. A session end made in a
 * transaction takes effect only if Postgres reports that transaction
 * committed, so it rolls back with the caller as the real fence does.
 */
export function createFakeIdentity(options: FakeIdentityOptions): FakeIdentity {
  const { hooks } = options;
  const sessions = new Map<string, FakeSession>();
  const generations = new Map<string, number>();
  const accounts = new Map<string, string>();
  const links = new Map<string, Date>();
  let pending: PendingEnd[] = [];

  /** Applies committed ends, drops aborted ones, returns ids ended as `reader` sees them. */
  async function ended(reader?: string): Promise<Set<string>> {
    const view = new Set<string>();
    if (pending.length === 0) return view;
    const statuses = await db.execute<{ txid: string; status: string | null }>(
      sql`select t.txid, txid_status(t.txid::bigint) as status
          from unnest(array[${sql.join(
            pending.map((end) => sql`${end.txid}`),
            sql`, `,
          )}]::text[]) as t(txid)`,
    );
    const status = new Map(statuses.rows.map((row) => [row.txid, row.status]));
    pending = pending.filter((end) => {
      const state = status.get(end.txid);
      if (state === "committed") {
        for (const id of end.sessionIds) sessions.delete(id);
        return false;
      }
      if (state !== "in progress") return false;
      if (end.txid === reader) for (const id of end.sessionIds) view.add(id);
      return true;
    });
    return view;
  }

  async function liveSessions(reader?: string) {
    const gone = await ended(reader);
    return [...sessions.values()].filter((session) => !gone.has(session.id));
  }

  async function lockUser(tx: DbOrTx, userId: string) {
    await tx
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, userId))
      .for("update");
  }

  async function endInTransaction(tx: DbOrTx, sessionIds: string[]) {
    if (sessionIds.length > 0)
      pending.push({ txid: await currentTxid(tx), sessionIds });
    return sessionIds;
  }

  async function readIdentity(userId: string) {
    const [user] = await db
      .select({
        name: schema.userTable.name,
        email: schema.userTable.email,
        emailVerified: schema.userTable.emailVerified,
      })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, userId))
      .limit(1);
    return user ? { userId, subject: userId, ...user } : null;
  }

  return {
    async resolve(headers) {
      if (options.signedInAs) return options.signedInAs;
      const token = readToken(headers);
      if (!token) return null;
      const session = (await liveSessions()).find(
        (candidate) => candidate.token === token,
      );
      if (!session || session.expiresAt <= new Date()) return null;
      if (!(await hooks.canSignIn({ userId: session.userId }))) return null;
      const identity = await readIdentity(session.userId);
      return identity ? { identity, sessionId: session.id } : null;
    },

    async handle(request) {
      if (options.handle) return options.handle(request);
      return Response.json({ message: "Not Found" }, { status: 404 });
    },

    sessions: {
      async list(userId) {
        const now = new Date();
        return (await liveSessions())
          .filter(
            (session) => session.userId === userId && session.expiresAt > now,
          )
          .sort(
            (a, b) =>
              b.updatedAt.getTime() - a.updatedAt.getTime() ||
              b.id.localeCompare(a.id),
          )
          .map(({ token: _token, userId: _userId, ...info }) => info);
      },
      async existing(sessionIds) {
        const live = new Set((await liveSessions()).map((s) => s.id));
        return new Set(sessionIds.filter((id) => live.has(id)));
      },
      async countActiveUsers(since) {
        const userIds = [
          ...new Set(
            (await liveSessions())
              .filter((session) => session.updatedAt >= since)
              .map((session) => session.userId),
          ),
        ];
        if (userIds.length === 0) return 0;
        const rows = await db
          .select({ id: schema.userTable.id })
          .from(schema.userTable)
          .where(
            and(inArray(schema.userTable.id, userIds), notBannedCondition()),
          );
        return rows.length;
      },
    },

    fence: {
      async sessionIsLive(tx, { userId, sessionId }) {
        const session = (await liveSessions(await currentTxid(tx))).find(
          (candidate) => candidate.id === sessionId,
        );
        return (
          session?.userId === userId && session.expiresAt.getTime() > Date.now()
        );
      },
      async credentialGeneration(_tx, userId) {
        return generations.get(userId) ?? null;
      },
      async endSessions(tx, userId, which) {
        await lockUser(tx, userId);
        const mine = (await liveSessions(await currentTxid(tx))).filter(
          (session) => session.userId === userId,
        );
        const ids = mine
          .filter((session) =>
            "ids" in which
              ? which.ids.includes(session.id)
              : session.id !== which.allExcept,
          )
          .map((session) => session.id);
        return endInTransaction(tx, ids);
      },
      async removeUser(tx, userId) {
        await lockUser(tx, userId);
        const mine = (await liveSessions(await currentTxid(tx)))
          .filter((session) => session.userId === userId)
          .map((session) => session.id);
        await endInTransaction(tx, mine);
        await tx
          .delete(schema.userTable)
          .where(eq(schema.userTable.id, userId));
      },
    },

    users: userRows,

    credentials: {
      async passwordSetupLink(userId, purpose) {
        const link = `fake://password/${purpose}/${userId}/${randomUUID()}`;
        links.set(link, new Date(Date.now() + LINK_SECONDS[purpose] * 1000));
        return link;
      },
      async emailVerificationLink(userId) {
        return `fake://verify/${userId}/${randomUUID()}`;
      },
    },

    async linkedAccount(userId) {
      const accountId = accounts.get(userId);
      return accountId ? { accountId } : null;
    },

    addSession(userId, input = {}) {
      const now = new Date();
      const session: FakeSession = {
        id: input.id ?? randomUUID(),
        token: input.token ?? randomUUID(),
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
        expiresAt: input.expiresAt ?? new Date(now.getTime() + 3_600_000),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        userId,
      };
      sessions.set(session.id, session);
      return session;
    },
    updateSession(sessionId, patch) {
      const session = sessions.get(sessionId);
      if (session) Object.assign(session, patch);
    },
    changePassword(userId) {
      const current = generations.get(userId);
      generations.set(userId, current === undefined ? 0 : current + 1);
    },
    linkAccount(userId, accountId) {
      accounts.set(userId, accountId);
    },
    linkExpiresAt(link) {
      return links.get(link);
    },
    headersFor(token) {
      return new Headers({ cookie: `${FAKE_SESSION_COOKIE}=${token}` });
    },
  };
}
