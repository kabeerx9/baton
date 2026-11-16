// The squashed upstream chain ended at 0081_outbox. These values are what
// drizzle recorded for its final version (sha256 of the SQL file and the
// journal `when`). An earlier 0081 without outbox.exempt_claims had another
// hash and timestamp, so it is refused rather than adopted. The row count is
// not checked: a database that re-applied 0081 records both versions.
export const OLD_CHAIN_LENGTH = 82;
export const OLD_FINAL_MIGRATION = {
  hash: "874deedc0a4580efa099219fa4936707a101e0f265f13b7d8e5b8bbf0e7432eb",
  createdAt: 1794822251721,
} as const;

export type LedgerRow = { hash: string; createdAt: number };
export type BaselineEntry = { hash: string; createdAt: number };

export type LedgerState =
  | { kind: "empty" }
  | { kind: "adopted" }
  | { kind: "old-final" }
  | { kind: "unknown"; reason: string };

function sameEntry(row: LedgerRow, entry: LedgerRow) {
  return row.hash === entry.hash && row.createdAt === entry.createdAt;
}

// Only "old-final" may be rewritten. Anything this does not recognize is
// "unknown", which the caller treats as a refusal.
//
// `later` lists the migrations shipped after the baseline. A ledger holding
// the baseline followed only by those (as recorded once the API applied
// them) is still "adopted", so running adoption again is a no-op.
export function classifyLedger(
  rows: readonly LedgerRow[],
  baseline: BaselineEntry,
  later: readonly BaselineEntry[] = [],
): LedgerState {
  if (rows.length === 0) return { kind: "empty" };

  if (rows.some((row) => row.hash === baseline.hash)) {
    const [first, ...rest] = [...rows].sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    const legitimate =
      sameEntry(first!, baseline) &&
      rest.every((row) => later.some((entry) => sameEntry(row, entry)));
    return legitimate
      ? { kind: "adopted" }
      : {
          kind: "unknown",
          reason: "the baseline is recorded next to unknown migrations",
        };
  }

  const last = rows.reduce((latest, row) =>
    row.createdAt > latest.createdAt ? row : latest,
  );
  if (!sameEntry(last, OLD_FINAL_MIGRATION)) {
    return {
      kind: "unknown",
      reason: "the last recorded migration is not the final 0081_outbox",
    };
  }
  return { kind: "old-final" };
}
