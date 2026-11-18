import type { DbOrTx } from "../project-access/db-or-tx";

/** Who a caller is. Everything Baton needs from the provider about a person. */
export type Identity = {
  /** Baton's id, the foreign key everywhere. */
  userId: string;
  /** The provider's id for this person; equals `userId` under Better Auth. */
  subject: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export type Caller = { identity: Identity; sessionId: string };

export type SessionInfo = {
  id: string;
  createdAt: Date;
  /** Last activity. */
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

export type EndSessions = { ids: string[] } | { allExcept: string | null };

/** How long a password link lives: a new account's first link, or a reset. */
export type PasswordLinkPurpose = "setup" | "reset";

export interface IdentityProvider {
  /** Cookie or bearer session. Null when not signed in. A bad credential is null, never a throw. */
  resolve(headers: Headers): Promise<Caller | null>;
  /** The provider's own HTTP surface under /api/auth. */
  handle(request: Request): Promise<Response>;
  sessions: {
    /** Unexpired sessions, newest activity first. */
    list(userId: string): Promise<SessionInfo[]>;
    /** Socket recheck only, never authorization. */
    existing(sessionIds: string[]): Promise<Set<string>>;
    /** Admin overview; not-banned users only. */
    countActiveUsers(since: Date): Promise<number>;
  };
  /**
   * The fence. Each method runs in the caller's transaction, after the caller
   * has locked the `user` row FOR UPDATE. The adapter answers from rows in
   * Baton's database, never from a remote call. The adapter's own
   * session-ending paths take the same user lock first. `credentialGeneration`
   * may also be read without the lock when a code is issued; only the read at
   * redemption is the fenced one.
   */
  fence: {
    sessionIsLive(
      tx: DbOrTx,
      input: { userId: string; sessionId: string },
    ): Promise<boolean>;
    /** Null: the user has no password. */
    credentialGeneration(tx: DbOrTx, userId: string): Promise<number | null>;
    /** Returns the ids it ended. */
    endSessions(
      tx: DbOrTx,
      userId: string,
      which: EndSessions,
    ): Promise<string[]>;
    removeUser(tx: DbOrTx, userId: string): Promise<void>;
  };
  /** Identity fields an instance admin changes. Same transaction as the audit row. */
  users: {
    /** Null: the email is taken. */
    create(
      tx: DbOrTx,
      input: { name: string; email: string },
    ): Promise<{ userId: string } | null>;
    update(
      tx: DbOrTx,
      userId: string,
      patch: { name?: string; email?: string; emailVerified?: boolean },
    ): Promise<void>;
  };
  credentials: {
    passwordSetupLink(
      userId: string,
      purpose: PasswordLinkPurpose,
    ): Promise<string>;
    emailVerificationLink(userId: string): Promise<string>;
  };
  /** Read only. */
  linkedAccount(
    userId: string,
    provider: "github",
  ): Promise<{ accountId: string } | null>;
}

export type SignUpDecision =
  | { ok: true }
  | { ok: false; code: string; message: string };

/** Baton gives these to the adapter at start-up. The adapter calls them; it holds no domain rule. */
export type IdentityHooks = {
  canSignUp(input: { email: string }): Promise<SignUpDecision>;
  /** False for a banned user. */
  canSignIn(input: { userId: string }): Promise<boolean>;
  /** Default instance role, first-admin promotion. */
  userCreated(identity: Identity): Promise<void>;
  /** Close sockets. */
  userDeleted(userId: string): Promise<void>;
  /** Provider-initiated ends only. */
  sessionsEnded(userId: string, sessionIds: string[]): Promise<void>;
  /** Revoke MCP grants (reset only, not a plain password change). */
  passwordReset(userId: string): Promise<void>;
};
