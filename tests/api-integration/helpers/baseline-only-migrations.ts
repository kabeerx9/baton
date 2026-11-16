import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../apps/api/drizzle",
);

/**
 * A temporary migrations folder holding only the baseline: a database as
 * it was before any later migration. Call `remove` when done.
 */
export function baselineOnlyMigrations() {
  const folder = mkdtempSync(join(tmpdir(), "baton-baseline-"));
  mkdirSync(join(folder, "meta"));
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };
  const [baseline] = journal.entries;
  writeFileSync(
    join(folder, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries: [baseline] }),
  );
  copyFileSync(
    join(migrationsFolder, `${baseline!.tag}.sql`),
    join(folder, `${baseline!.tag}.sql`),
  );
  return {
    folder,
    remove: () => rmSync(folder, { recursive: true, force: true }),
  };
}
