import { randomBytes } from "node:crypto";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Throws unless `connectionString` names a `_test` database on this machine.
 * Scratch databases are created and force-dropped on that server, so it must
 * never be a shared or hosted one.
 */
export function assertLocalTestServer(connectionString: string) {
  const url = new URL(connectionString);
  if (!LOCAL_HOSTS.has(url.hostname))
    throw new Error(
      `Refusing to manage scratch databases on "${url.hostname}": DATABASE_URL must point at localhost.`,
    );
  const database = url.pathname.replace(/^\//, "");
  if (!database.endsWith("_test"))
    throw new Error(
      `Refusing to manage scratch databases next to "${database}": DATABASE_URL must name a _test database.`,
    );
}

/** A name no other run uses: `baton_<label>_<12 hex>_test`. */
export function scratchDatabaseName(label: string) {
  if (!/^[a-z0-9_]{1,30}$/.test(label))
    throw new Error(`Invalid scratch database label "${label}"`);
  return `baton_${label}_${randomBytes(6).toString("hex")}_test`;
}
