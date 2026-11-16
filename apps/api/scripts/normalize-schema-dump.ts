// Prints a normalized `pg_dump --schema-only` file for diffing; see
// adopt-migration-baseline.ts for the runbook that uses it.
import { readFileSync } from "node:fs";
import { normalizeSchemaDump } from "./adopt-migration-baseline/normalize-schema-dump";

const [path] = process.argv.slice(2);
if (!path) {
  console.error("Usage: tsx scripts/normalize-schema-dump.ts <dump.sql>");
  process.exit(1);
}
process.stdout.write(`${normalizeSchemaDump(readFileSync(path, "utf8"))}\n`);
