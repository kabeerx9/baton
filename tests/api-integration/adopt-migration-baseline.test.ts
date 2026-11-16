import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import db, { getDatabasePool } from "../../apps/api/src/database";
import {
  adoptMigrationBaseline,
  type LedgerLocation,
  readBaselineEntry,
} from "../../apps/api/scripts/adopt-migration-baseline/adopt-ledger";
import {
  OLD_CHAIN_LENGTH,
  OLD_FINAL_MIGRATION,
} from "../../apps/api/scripts/adopt-migration-baseline/classify-ledger";
import { ensureTestDatabaseMigrated } from "./helpers/database";

// A throwaway ledger, so the suite's real drizzle ledger is never rewritten.
// The public schema is already migrated, so a migrate against this ledger
// fails on existing tables unless it is a no-op.
const ledger: LedgerLocation = {
  schema: "adopt_baseline_test",
  table: "__drizzle_migrations",
};
const table = `"${ledger.schema}"."${ledger.table}"`;
const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../apps/api/drizzle",
);
const baseline = readBaselineEntry(migrationsFolder);

type Row = { hash: string; created_at: number };

async function query<T>(text: string, values: unknown[] = []) {
  return (await getDatabasePool().query(text, values)).rows as T[];
}

async function writeLedger(rows: Row[]) {
  await query(`CREATE SCHEMA ${ledger.schema}`);
  await query(
    `CREATE TABLE ${table} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
  );
  for (const row of rows)
    await query(`INSERT INTO ${table} (hash, created_at) VALUES ($1, $2)`, [
      row.hash,
      row.created_at,
    ]);
}

function readLedger() {
  return query<{ hash: string; created_at: string }>(
    `SELECT hash, created_at FROM ${table} ORDER BY id`,
  );
}

const finalRow: Row = {
  hash: OLD_FINAL_MIGRATION.hash,
  created_at: OLD_FINAL_MIGRATION.createdAt,
};

function oldChain(final: Row = finalRow): Row[] {
  return [
    ...Array.from({ length: OLD_CHAIN_LENGTH - 1 }, (_, index) => ({
      hash: `old-${index}`,
      created_at: 1_700_000_000_000 + index,
    })),
    final,
  ];
}

// Each run holds its own client, as the CLI does, so two runs can race.
async function adopt() {
  const client = await getDatabasePool().connect();
  try {
    return await adoptMigrationBaseline(client, baseline, ledger);
  } finally {
    client.release();
  }
}

beforeEach(async () => {
  await ensureTestDatabaseMigrated();
  await query(`DROP SCHEMA IF EXISTS ${ledger.schema} CASCADE`);
});

afterEach(async () => {
  await query(`DROP SCHEMA IF EXISTS ${ledger.schema} CASCADE`);
});

it("replaces the full old chain with the baseline, so migrate is a no-op", async () => {
  await writeLedger(oldChain());

  expect(await adopt()).toEqual({
    kind: "adopted",
    replaced: OLD_CHAIN_LENGTH,
  });
  expect(await readLedger()).toEqual([
    { hash: baseline.hash, created_at: String(baseline.createdAt) },
  ]);

  await migrate(db, { migrationsFolder, migrationsSchema: ledger.schema });
  expect(await readLedger()).toHaveLength(1);
});

it("adopts a ledger that recorded both versions of 0081", async () => {
  const earlier0081 = {
    hash: "d174d3a1c473e4f06885be993d8f288beeee62d7a73b0ba4529156603202f827",
    created_at: 1794818083439,
  };
  const rows = oldChain();
  await writeLedger([...rows.slice(0, -1), earlier0081, rows.at(-1)!]);

  expect(await adopt()).toEqual({
    kind: "adopted",
    replaced: OLD_CHAIN_LENGTH + 1,
  });
  expect(await readLedger()).toHaveLength(1);
});

it("is a no-op when run again", async () => {
  await writeLedger(oldChain());
  await adopt();
  const adopted = await readLedger();

  expect(await adopt()).toEqual({ kind: "already-adopted" });
  expect(await readLedger()).toEqual(adopted);
});

it("adopts exactly once when two runs race", async () => {
  await writeLedger(oldChain());

  const results = await Promise.all([adopt(), adopt()]);
  expect(results.map((result) => result.kind).sort()).toEqual([
    "adopted",
    "already-adopted",
  ]);
  expect(await readLedger()).toHaveLength(1);
});

it.each([
  ["at 0080", oldChain().slice(0, -1)],
  [
    "at the earlier 0081 without exempt_claims",
    oldChain({
      hash: "d174d3a1c473e4f06885be993d8f288beeee62d7a73b0ba4529156603202f827",
      created_at: 1794818083439,
    }),
  ],
  [
    "holding both the old chain and the baseline",
    [...oldChain(), { hash: baseline.hash, created_at: baseline.createdAt }],
  ],
  ["with no recorded migrations", []],
])("refuses a ledger %s and leaves it untouched", async (_, rows) => {
  await writeLedger(rows);
  const before = await readLedger();

  expect(await adopt()).toMatchObject({ kind: "refused" });
  expect(await readLedger()).toEqual(before);
});

it("refuses when the ledger table does not exist", async () => {
  expect(await adopt()).toMatchObject({ kind: "refused" });
  expect(
    await query(`SELECT to_regclass('${ledger.schema}.${ledger.table}') AS t`),
  ).toEqual([{ t: null }]);
});
