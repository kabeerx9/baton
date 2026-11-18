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
 * A temporary migrations folder holding the migrations up to and including
 * `tag`: a database as it was at that point. Call `remove` when done.
 */
export function migrationsThrough(tag: string) {
  const folder = mkdtempSync(join(tmpdir(), "baton-migrations-"));
  mkdirSync(join(folder, "meta"));
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };
  const end = journal.entries.findIndex((entry) => entry.tag === tag);
  if (end === -1) throw new Error(`No migration tagged ${tag}`);
  const entries = journal.entries.slice(0, end + 1);
  writeFileSync(
    join(folder, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries }),
  );
  for (const entry of entries) {
    copyFileSync(
      join(migrationsFolder, `${entry.tag}.sql`),
      join(folder, `${entry.tag}.sql`),
    );
  }
  return {
    folder,
    remove: () => rmSync(folder, { recursive: true, force: true }),
  };
}

/**
 * A temporary migrations folder holding only the baseline: a database as
 * it was before any later migration. Call `remove` when done.
 */
export function baselineOnlyMigrations() {
  return migrationsThrough("0000_baseline");
}
