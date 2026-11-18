import { randomBytes } from "node:crypto";
import { createEmailVerificationToken, isAPIError } from "better-auth/api";
import { and, count, desc, eq, gt, gte, inArray, ne, sql } from "drizzle-orm";
import db from "../../database";
import { accountTable, sessionTable, userTable } from "../../database/schema";
import { notBannedCondition } from "../../utils/user-ban";
import type { IdentityHooks, IdentityProvider, SessionInfo } from "../port";
import { userRows } from "../user-rows";
import type { auth as betterAuth } from "./auth";

type Auth = typeof betterAuth;

// A new account has longer to act on its first email than a reset link.
const SETUP_LINK_SECONDS = 2 * 24 * 60 * 60;
const VERIFICATION_LINK_SECONDS = 24 * 60 * 60;

function clientUrl(path: string) {
  const base = process.env.BATON_CLIENT_URL || "http://localhost:5173";
  return encodeURIComponent(`${base.replace(/\/$/, "")}${path}`);
}

function isRejection(error: unknown) {
  if (!isAPIError(error)) return false;
  const status = typeof error.statusCode === "number" ? error.statusCode : 0;
  return status >= 400 && status < 500;
}

async function readUser(userId: string) {
  const [user] = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!user) throw new Error("User not found");
  return user;
}

/** The Better Auth adapter. Its fence reads and writes the provider's tables in Baton's database. */
export function createBetterAuthIdentity(
  auth: Auth,
  hooks: IdentityHooks,
): IdentityProvider {
  return {
    async resolve(headers) {
      const sessionHeaders = new Headers(headers);
      // With `enableSessionForAPIKeys` a key header would resolve to its
      // owner's session. API keys are Baton's; this is a person's session only.
      sessionHeaders.delete("x-api-key");
      let found: Awaited<ReturnType<Auth["api"]["getSession"]>>;
      try {
        found = await auth.api.getSession({ headers: sessionHeaders });
      } catch (error) {
        if (isRejection(error)) return null;
        throw error;
      }
      if (!found?.user || !found.session) return null;
      // A second guard: deactivation also ends every session.
      if (!(await hooks.canSignIn({ userId: found.user.id }))) return null;
      return {
        identity: {
          userId: found.user.id,
          subject: found.user.id,
          email: found.user.email,
          name: found.user.name,
          emailVerified: found.user.emailVerified,
        },
        sessionId: found.session.id,
      };
    },

    handle: (request) => auth.handler(request),

    sessions: {
      async list(userId) {
        const rows: SessionInfo[] = await db
          .select({
            id: sessionTable.id,
            createdAt: sessionTable.createdAt,
            updatedAt: sessionTable.updatedAt,
            expiresAt: sessionTable.expiresAt,
            ipAddress: sessionTable.ipAddress,
            userAgent: sessionTable.userAgent,
          })
          .from(sessionTable)
          .where(
            and(
              eq(sessionTable.userId, userId),
              gt(sessionTable.expiresAt, new Date()),
            ),
          )
          .orderBy(desc(sessionTable.updatedAt), desc(sessionTable.id));
        return rows;
      },
      async existing(sessionIds) {
        if (sessionIds.length === 0) return new Set();
        const rows = await db
          .select({ id: sessionTable.id })
          .from(sessionTable)
          .where(inArray(sessionTable.id, sessionIds));
        return new Set(rows.map((row) => row.id));
      },
      async countActiveUsers(since) {
        const [row] = await db
          .select({ value: count() })
          .from(userTable)
          .where(
            and(
              notBannedCondition(),
              sql`exists (${db
                .select({ id: sessionTable.id })
                .from(sessionTable)
                .where(
                  and(
                    eq(sessionTable.userId, userTable.id),
                    gte(sessionTable.updatedAt, since),
                  ),
                )})`,
            ),
          );
        return row?.value ?? 0;
      },
    },

    fence: {
      async sessionIsLive(tx, { userId, sessionId }) {
        // Locks the session row so a concurrent delete waits for this
        // transaction, in the user-then-session order every delete takes.
        const [row] = await tx
          .select({ id: sessionTable.id })
          .from(sessionTable)
          .where(
            and(
              eq(sessionTable.id, sessionId),
              eq(sessionTable.userId, userId),
              gt(sessionTable.expiresAt, new Date()),
            ),
          )
          .limit(1)
          .for("update");
        return Boolean(row);
      },
      async credentialGeneration(tx, userId) {
        const [credential] = await tx
          .select({ generation: accountTable.credentialGeneration })
          .from(accountTable)
          .where(
            and(
              eq(accountTable.userId, userId),
              eq(accountTable.providerId, "credential"),
            ),
          )
          .limit(1);
        return credential?.generation ?? null;
      },
      async endSessions(tx, userId, which) {
        // Re-taking the caller's lock is a no-op; it keeps the order for any
        // caller that reaches here first: user row, then session rows.
        await tx
          .select({ id: userTable.id })
          .from(userTable)
          .where(eq(userTable.id, userId))
          .for("update");
        if ("ids" in which && which.ids.length === 0) return [];
        const deleted = await tx
          .delete(sessionTable)
          .where(
            and(
              eq(sessionTable.userId, userId),
              "ids" in which
                ? inArray(sessionTable.id, which.ids)
                : which.allExcept
                  ? ne(sessionTable.id, which.allExcept)
                  : undefined,
            ),
          )
          .returning({ id: sessionTable.id });
        return deleted.map((row) => row.id);
      },
      async removeUser(tx, userId) {
        await tx
          .select({ id: userTable.id })
          .from(userTable)
          .where(eq(userTable.id, userId))
          .for("update");
        // Sessions, accounts and API keys cascade with the user row.
        await tx.delete(userTable).where(eq(userTable.id, userId));
      },
    },

    users: userRows,

    credentials: {
      /**
       * A link to choose a password, through the same single-use token and
       * `/reset-password` flow as self-service resets.
       */
      async passwordSetupLink(userId, purpose) {
        const context = await auth.$context;
        const seconds =
          purpose === "setup"
            ? SETUP_LINK_SECONDS
            : (context.options.emailAndPassword?.resetPasswordTokenExpiresIn ??
              3600);
        const token = randomBytes(18).toString("base64url");
        await context.internalAdapter.createVerificationValue({
          identifier: `reset-password:${token}`,
          value: userId,
          expiresAt: new Date(Date.now() + seconds * 1000),
        });
        return `${context.baseURL}/reset-password/${token}?callbackURL=${clientUrl("/auth/reset-password")}`;
      },
      /** A link that marks the address verified through `/verify-email`. */
      async emailVerificationLink(userId) {
        const user = await readUser(userId);
        const context = await auth.$context;
        const token = await createEmailVerificationToken(
          context.secret,
          user.email,
          undefined,
          VERIFICATION_LINK_SECONDS,
        );
        return `${context.baseURL}/verify-email?token=${token}&callbackURL=${clientUrl("/auth/sign-in")}`;
      },
    },

    async linkedAccount(userId, provider) {
      const [account] = await db
        .select({ accountId: accountTable.accountId })
        .from(accountTable)
        .where(
          and(
            eq(accountTable.userId, userId),
            eq(accountTable.providerId, provider),
          ),
        )
        .limit(1);
      return account ?? null;
    },
  };
}
