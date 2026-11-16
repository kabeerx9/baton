// One-time conversion of a database that ran the squashed upstream chain
// (0000..0081_outbox) to the single 0000_baseline migration. It only rewrites
// drizzle's ledger; the schema is already identical. Back up the database,
// stop the API, then run from apps/api:
//
//   pnpm exec tsx scripts/adopt-migration-baseline.ts
//
// It uses the API's DATABASE_URL (or POSTGRES_* settings). It refuses unless
// the ledger ends at the final 0081_outbox, and re-running it is a no-op.
import { resolve } from "node:path";
import { config } from "dotenv-mono";
import { Pool } from "pg";
import { resolveDatabaseConnectionString } from "../src/database/resolve-database-url";
import {
  adoptMigrationBaseline,
  readBaselineEntry,
} from "./adopt-migration-baseline/adopt-ledger";

config();

const pool = new Pool({ connectionString: resolveDatabaseConnectionString() });
const client = await pool.connect();

try {
  const baseline = readBaselineEntry(
    resolve(import.meta.dirname, "../drizzle"),
  );
  const result = await adoptMigrationBaseline(client, baseline);

  if (result.kind === "adopted") {
    console.log(
      `Adopted 0000_baseline: replaced ${result.replaced} recorded migrations.`,
    );
  } else if (result.kind === "already-adopted") {
    console.log("Already on 0000_baseline; nothing to do.");
  } else {
    console.error(`Refused: ${result.reason}`);
    process.exitCode = 1;
  }
} finally {
  client.release();
  await pool.end();
}
