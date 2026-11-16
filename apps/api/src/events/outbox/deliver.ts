import * as Sentry from "@sentry/node";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import db, { getDatabasePool, schema } from "../../database";
import { outboxTable } from "../../database/schema";
import type { Channel } from "../../utils/request-channel";
import { eventContext } from "../context";
import { publishLive } from "../index";
import { type ClaimedRow, LEASE_MS, type OutboxRow } from "./claim";
import type { ConsumerResult, LocalConsumer } from "./consumer";
import { errorCode } from "./error-code";
import { type Step, preflight, readDelivery, transition } from "./lifecycle";
import { findConsumer } from "./registry";

const dbNow = sql`(clock_timestamp() AT TIME ZONE 'utc')`;

/**
 * After the call timeout, a handler gets this long to settle (and roll
 * back). Then its connection is destroyed and the lane moves on.
 */
export const HARD_TIMEOUT_GRACE_MS = 1_000;

/**
 * A delivery that commits later than this after its event may land after
 * the board refetched, so it sends the consumer's late hint.
 */
export const LATE_DELIVERY_MS = 1_000;

export type DeliveryResult =
  | "delivered"
  | "dropped"
  | "retry"
  | "dead"
  | "stale"
  | "skipped";

/** Every outcome write is fenced: a worker whose lease was taken changes nothing. */
function fence(row: OutboxRow) {
  return and(
    eq(outboxTable.id, row.id),
    eq(outboxTable.state, "pending"),
    eq(outboxTable.attempts, row.attempts),
  );
}

class StaleCompletion extends Error {
  constructor() {
    super("Outbox row was reclaimed by another relay");
    this.name = "StaleCompletion";
  }
}

class OutboxTimeout extends Error {
  constructor() {
    super("Outbox handler timed out");
    this.name = "OutboxTimeout";
  }
}

/**
 * Runs a local handler and the fenced delete in one transaction on its own
 * connection, so a timeout can never leave the handler writing outside it.
 * - Soft timeout (`timeoutMs`, also `statement_timeout`): the transaction
 *   is marked; when the handler settles it rolls back instead of committing.
 * - Hard timeout (`timeoutMs + HARD_TIMEOUT_GRACE_MS`): the connection is
 *   destroyed. Postgres rolls the transaction back, and any later query
 *   from the abandoned handler fails, so it cannot write in autocommit.
 * A commit that races the hard timeout already deleted the row, so the
 * retry write that follows is fenced out and nothing repeats.
 */
async function runLocal(
  consumer: LocalConsumer,
  claimed: ClaimedRow,
  timeoutMs: number,
): Promise<ConsumerResult> {
  const { row } = claimed;
  const context = {
    initiatorId: row.initiatorId ?? "",
    channel: (row.channel as Channel | null) ?? null,
  };
  const client = await getDatabasePool().connect();
  let released = false;
  const release = (error?: Error) => {
    if (released) return;
    released = true;
    client.release(error);
  };
  let timedOut = false;
  const work = drizzle(client, { schema }).transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('statement_timeout', ${String(timeoutMs)}, true)`,
    );
    const result = await eventContext.run(context, () =>
      consumer.deliver(tx, row),
    );
    if (timedOut) throw new OutboxTimeout();
    if (result.kind === "unknown") return result;
    // The delete shares the handler's transaction: if another relay took
    // the row, nothing is deleted and the handler's write rolls back.
    const deleted = await tx
      .delete(outboxTable)
      .where(fence(row))
      .returning({ id: outboxTable.id });
    if (!deleted.length) throw new StaleCompletion();
    if (timedOut) throw new OutboxTimeout();
    return result;
  });
  // The abandoned transaction rejects once its connection is gone.
  work.catch(() => undefined);
  const timers: NodeJS.Timeout[] = [];
  const hard = new Promise<never>((_, reject) => {
    timers.push(
      setTimeout(() => {
        timedOut = true;
      }, timeoutMs),
      setTimeout(() => {
        release(new OutboxTimeout());
        reject(new OutboxTimeout());
      }, timeoutMs + HARD_TIMEOUT_GRACE_MS),
    );
  });
  try {
    return await Promise.race([work, hard]);
  } finally {
    for (const timer of timers) clearTimeout(timer);
    release();
  }
}

async function applyStep(row: OutboxRow, step: Step, error: string) {
  if (step.op === "delete") return "delivered" as const;
  if (step.op === "retry") {
    const updated = await db
      .update(outboxTable)
      .set({
        nextAttemptAt: sql`${dbNow} + ${step.delayMs} * interval '1 millisecond'`,
        lastError: error,
        ...(step.exempt
          ? { exemptClaims: sql`${outboxTable.exemptClaims} + 1` }
          : {}),
      })
      .where(fence(row))
      .returning({ id: outboxTable.id });
    return updated.length ? ("retry" as const) : ("stale" as const);
  }
  // A dead row's next_attempt_at records when it died: the health job
  // reports new dead rows by it and the prune job keeps them 30 days.
  const updated = await db
    .update(outboxTable)
    .set({ state: "dead", nextAttemptAt: dbNow, lastError: error })
    .where(fence(row))
    .returning({ id: outboxTable.id });
  if (!updated.length) return "stale" as const;
  const facts = {
    id: row.id,
    type: row.type,
    consumer: row.consumer,
    workspaceId: row.workspaceId,
    attempts: row.attempts,
    reason: step.reason,
    error,
  };
  console.error("Outbox delivery is dead", facts);
  Sentry.captureMessage("Outbox delivery is dead", {
    level: "error",
    tags: { area: "outbox", consumer: row.consumer, type: row.type },
    extra: facts,
  });
  return "dead" as const;
}

/**
 * Runs one claimed row and records its outcome. Never throws for a handler
 * failure; a database error while recording leaves the row to its lease.
 */
export async function deliverOutboxRow(
  claimed: ClaimedRow,
  { timeoutMs }: { timeoutMs: number },
): Promise<DeliveryResult> {
  const { row } = claimed;
  const delivery = readDelivery(row);
  const consumer = findConsumer(row.consumer);
  if (delivery.state === "dead" || !consumer) return "skipped";
  // A batch run in its mode ends within the lease, so this only trips
  // after a stall. Another relay may already own the row; leave it.
  if (
    performance.now() - claimed.claimedAt >=
    LEASE_MS - timeoutMs - HARD_TIMEOUT_GRACE_MS
  )
    return "skipped";

  let outcome = preflight(delivery, consumer.reads(row));
  if (!outcome) {
    try {
      const result = await runLocal(consumer, claimed, timeoutMs);
      if (result.kind === "dropped") return "dropped";
      if (result.kind === "delivered") {
        // Age at commit: the row's age at claim (database clock) plus the
        // time since, which covers the batch, the pool and the handler.
        const age = claimed.ageMs + (performance.now() - claimed.claimedAt);
        if (result.lateHint && age > LATE_DELIVERY_MS)
          await publishLive(result.lateHint.type, result.lateHint.data);
        return "delivered";
      }
      outcome = { kind: "unknown" };
    } catch (error) {
      if (error instanceof StaleCompletion) return "stale";
      outcome = { kind: "failed", error: errorCode(error) };
    }
  }
  const step = transition(delivery, outcome, new Date(), Math.random);
  const lastError =
    outcome.kind === "failed" ? outcome.error : `outcome:${outcome.kind}`;
  return applyStep(row, step, lastError);
}
