import type db from "../../database";
import type { OutboxRow } from "./claim";
import type { ConsumerName, Lane } from "./routes";

export type OutboxTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/** A live push sent after the delivery commits; it never gets a row. */
export type LiveEvent = { type: string; data: Record<string, unknown> };

export type ConsumerResult =
  /** `lateHint` is published only if the delivery commits late. */
  | { kind: "delivered"; lateHint?: LiveEvent }
  | { kind: "dropped"; reason: string }
  | { kind: "unknown" };

/**
 * A local consumer writes in `tx`, the transaction that also deletes the
 * row, so a redelivery cannot repeat its write. Throwing means `failed`.
 */
export type LocalConsumer = {
  name: ConsumerName;
  lane: Extract<Lane, "local">;
  /** Whether this version can read the row's payload; pure. */
  reads: (row: OutboxRow) => boolean;
  deliver: (tx: OutboxTransaction, row: OutboxRow) => Promise<ConsumerResult>;
};
