/** An access token lives one hour; clients renew it with the refresh token. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
/** A grant nobody uses for 90 days stops working. There is no absolute cap. */
export const GRANT_IDLE_MS = 90 * 24 * 60 * 60 * 1000;
/**
 * Two processes of one agent can share a stored refresh token and refresh at
 * the same moment. A rotated token still works this long after rotation.
 */
export const REFRESH_GRACE_MS = 60 * 1000;
/**
 * Expired token rows one refresh deletes. A refresh adds two, so cleanup
 * keeps up with any refresh rate the token limit allows.
 */
export const EXPIRED_TOKEN_CLEANUP_BATCH = 100;
/** Bounds last-used writes to one per grant per minute. */
export const LAST_USED_WRITE_INTERVAL_MS = 60 * 1000;
/** Revoked or expired grants are pruned this long after they end. */
export const DEAD_GRANT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
