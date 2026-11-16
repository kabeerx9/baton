// One-time conversion of a database that ran the squashed upstream chain
// (0000..0081_outbox) to the single 0000_baseline migration. It only rewrites
// drizzle's ledger.
//
// Trust boundary: it trusts the ledger. It checks that the last recorded
// migration is the final 0081_outbox, but it does not inspect the schema, so
// a database that drifted from its ledger is adopted as-is. Before running
// it, prove the schema matches by comparing a schema-only dump of the target
// with a fresh baseline database (runbook below).
//
// Runbook, from apps/api. TARGET_URL is the database to convert; CHECK_URL is
// an empty scratch database on the same server.
//
//   1. Back up the target and stop the API.
//   2. Build the reference schema:
//        DATABASE_URL="$CHECK_URL" pnpm exec drizzle-kit migrate
//   3. Dump and normalize both (sorts statements and table columns, drops
//      comments and SET lines):
//        pg_dump --schema-only --no-owner --no-privileges --exclude-schema=drizzle "$TARGET_URL" > target.sql
//        pg_dump --schema-only --no-owner --no-privileges --exclude-schema=drizzle "$CHECK_URL" > check.sql
//        pnpm exec tsx scripts/normalize-schema-dump.ts target.sql > target.norm.sql
//        pnpm exec tsx scripts/normalize-schema-dump.ts check.sql > check.norm.sql
//        diff check.norm.sql target.norm.sql
//      Expected: only lines for public.github_integration (its table and
//      three constraints) appear on the check side, because API startup
//      drops that table. Any other line means drift: stop and fix it first.
//   4. Convert, naming the target explicitly:
//        DATABASE_URL="$TARGET_URL" pnpm exec tsx scripts/adopt-migration-baseline.ts
//      It prints the target before acting. Exit 0: adopted, or already
//      adopted. Exit 1: refused, ledger untouched.
//   5. Start the API. Its migrate step is a no-op.
//
// It requires DATABASE_URL or POSTGRES_* settings and refuses the API's
// localhost:5432/baton fallback.
import { resolve } from "node:path";
import { config } from "dotenv-mono";
import { Pool } from "pg";
import { resolveDatabaseConfig } from "../src/database/resolve-database-url";
import {
  adoptMigrationBaseline,
  readBaselineEntry,
} from "./adopt-migration-baseline/adopt-ledger";

config();

const target = resolveDatabaseConfig();
console.log(
  `Target: ${target.host}:${target.port}/${target.database} (from ${target.source})`,
);

if (target.source === "LOCAL_FALLBACK") {
  console.error(
    "Refused: no DATABASE_URL or POSTGRES_* settings; set the target explicitly.",
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: target.connectionString });
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
