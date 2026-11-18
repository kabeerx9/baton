import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { identity } from "../../identity";
import { revokeSessionConnections } from "../../ws";

/** Sign out one of the caller's other sessions. */
async function revokeOwnSession(
  userId: string,
  currentSessionId: string,
  sessionId: string,
) {
  if (sessionId === currentSessionId) {
    throw new HTTPException(409, {
      message: "Sign out to end the current session",
    });
  }
  const revoked = await db.transaction((tx) =>
    identity.fence.endSessions(tx, userId, { ids: [sessionId] }),
  );
  if (revoked.length === 0) {
    throw new HTTPException(404, { message: "Session not found" });
  }
  await revokeSessionConnections(userId, revoked);
  return { revoked: revoked.length };
}

export default revokeOwnSession;
