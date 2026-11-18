import { identity } from "../identity";
import { parseUserAgent } from "../utils/parse-user-agent";

/** A user's unexpired sessions, the caller's own first. Never includes tokens. */
export async function listActiveSessions(
  userId: string,
  currentSessionId: string | null,
) {
  const sessions = (await identity.sessions.list(userId)).map((session) => {
    const device = parseUserAgent(session.userAgent);
    return {
      id: session.id,
      browser: device?.browser ?? null,
      os: device?.os ?? null,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: session.updatedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === currentSessionId,
    };
  });
  return {
    sessions: [
      ...sessions.filter((session) => session.current),
      ...sessions.filter((session) => !session.current),
    ],
  };
}
