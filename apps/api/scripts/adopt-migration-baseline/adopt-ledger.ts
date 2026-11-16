import { readMigrationFiles } from "drizzle-orm/migrator";
import type { ClientBase } from "pg";
import {
  type BaselineEntry,
  classifyLedger,
  type LedgerState,
} from "./classify-ledger";

export type LedgerLocation = { schema: string; table: string };

export const DRIZZLE_LEDGER: LedgerLocation = {
  schema: "drizzle",
  table: "__drizzle_migrations",
};

export type AdoptResult =
  | { kind: "adopted"; replaced: number }
  | { kind: "already-adopted" }
  | { kind: "refused"; reason: string };

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

// Hash and timestamp come from the migration file and journal, exactly as
// drizzle's migrator computes them, so they cannot drift from the baseline.
export function readBaselineEntry(migrationsFolder: string): BaselineEntry {
  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length !== 1) {
    throw new Error(
      `Expected exactly one migration (the baseline), found ${migrations.length}`,
    );
  }
  const [baseline] = migrations;
  return { hash: baseline!.hash, createdAt: baseline!.folderMillis };
}

function refusal(state: LedgerState): string {
  switch (state.kind) {
    case "empty":
      return "no migrations are recorded; start the API to apply the baseline";
    case "unknown":
      return state.reason;
    default:
      return state.kind;
  }
}

// Rewrites the ledger in one transaction, holding an exclusive lock so a
// concurrent startup migrate cannot read it half-written.
export async function adoptMigrationBaseline(
  client: ClientBase,
  baseline: BaselineEntry,
  ledger: LedgerLocation = DRIZZLE_LEDGER,
): Promise<AdoptResult> {
  const table = `${quoteIdentifier(ledger.schema)}.${quoteIdentifier(ledger.table)}`;

  await client.query("BEGIN");
  try {
    const exists = await client.query<{ found: string | null }>(
      "SELECT to_regclass($1) AS found",
      [table],
    );
    if (!exists.rows[0]?.found) {
      await client.query("ROLLBACK");
      return {
        kind: "refused",
        reason: `${ledger.schema}.${ledger.table} does not exist; start the API to apply the baseline`,
      };
    }

    await client.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
    const { rows } = await client.query<{ hash: string; created_at: string }>(
      `SELECT hash, created_at FROM ${table} ORDER BY created_at`,
    );
    const state = classifyLedger(
      rows.map((row) => ({
        hash: row.hash,
        createdAt: Number(row.created_at),
      })),
      baseline,
    );

    if (state.kind === "adopted") {
      await client.query("ROLLBACK");
      return { kind: "already-adopted" };
    }
    if (state.kind !== "old-final") {
      await client.query("ROLLBACK");
      return { kind: "refused", reason: refusal(state) };
    }

    await client.query(`DELETE FROM ${table}`);
    await client.query(
      `INSERT INTO ${table} (hash, created_at) VALUES ($1, $2)`,
      [baseline.hash, baseline.createdAt],
    );
    await client.query("COMMIT");
    return { kind: "adopted", replaced: rows.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
