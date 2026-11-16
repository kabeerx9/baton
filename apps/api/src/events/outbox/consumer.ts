import type db from "../../database";
import type { OutboxRow } from "./claim";
import type { ConsumerName, Lane } from "./routes";

export type OutboxTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/** A live push sent after the delivery commits; it never gets a row. */
export type LiveEvent = { type: string; data: Record<string, unknown> };

export type ConsumerResult =
  | { kind: "delivered"; live?: LiveEvent }
  | { kind: "dropped"; reason: string }
  | { kind: "unknown" };

/**
 * A local consumer writes in `tx`, the transaction that also deletes the
 * row, so a redelivery cannot repeat its write. Throwing means `failed`.
 */
export type LocalConsumer = {
  name: ConsumerName;
  lane: Extract<Lane, "local">;
  deliver: (
    tx: OutboxTransaction,
    row: OutboxRow,
    context: { ageMs: number },
  ) => Promise<ConsumerResult>;
};
