import { Client } from "pg";
import {
  assertLocalTestServer,
  scratchDatabaseName,
} from "./scratch-database-name";

function urlFor(serverUrl: string, database: string) {
  const url = new URL(serverUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function onServer(serverUrl: string, statement: string) {
  const client = new Client({
    connectionString: urlFor(serverUrl, "postgres"),
  });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

export type ScratchDatabase = {
  name: string;
  url: string;
  /** Drops this database. Safe to call more than once. */
  drop: () => Promise<void>;
};

/**
 * Creates a database with a unique name on the suite's local server. `drop`
 * removes only that database, so concurrent runs cannot remove each other's.
 */
export async function createScratchDatabase(
  label: string,
  serverUrl = process.env.DATABASE_URL!,
): Promise<ScratchDatabase> {
  assertLocalTestServer(serverUrl);
  const name = scratchDatabaseName(label);
  // No IF NOT EXISTS: a name clash fails here instead of reusing a database.
  await onServer(serverUrl, `CREATE DATABASE "${name}"`);
  let dropped = false;
  return {
    name,
    url: urlFor(serverUrl, name),
    drop: async () => {
      if (dropped) return;
      dropped = true;
      await onServer(
        serverUrl,
        `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
      );
    },
  };
}
