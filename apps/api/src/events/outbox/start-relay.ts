import { type ClaimedRow, claimOutboxRows } from "./claim";
import { type DeliveryResult, deliverOutboxRow } from "./deliver";
import { errorCode } from "./error-code";
import { onOutboxNudge } from "./nudge";
import { type Lane, consumersInLane } from "./routes";
import { runDetached } from "../../observability/background-context";
import { logger } from "../../observability/logger";

export type LaneConfig = {
  /** Rows per claim. A batch, run in its mode, ends within the 60 s lease. */
  batch: number;
  /** The limit on one handler call. */
  timeoutMs: number;
  /** Local rows run one after another; provider calls run together. */
  mode: "sequential" | "parallel";
};

export const LANES: Record<Lane, LaneConfig> = {
  local: { batch: 10, timeoutMs: 5_000, mode: "sequential" },
  external: { batch: 4, timeoutMs: 20_000, mode: "parallel" },
};

export type LaneDeps = {
  claim: (consumers: string[], limit: number) => Promise<ClaimedRow[]>;
  deliver: (
    claimed: ClaimedRow,
    options: { timeoutMs: number },
  ) => Promise<DeliveryResult>;
};

const defaultDeps: LaneDeps = {
  claim: claimOutboxRows,
  deliver: deliverOutboxRow,
};

/** Claims and runs batches until no due row is left. Returns rows run. */
export async function drainLane(
  lane: Lane,
  deps: LaneDeps = defaultDeps,
  isStopped: () => boolean = () => false,
): Promise<number> {
  const consumers = consumersInLane(lane);
  const config = LANES[lane];
  let total = 0;
  // A stopping relay finishes its batch and claims no more; the rest of
  // the backlog stays pending for the next instance.
  while (!isStopped()) {
    const batch = await deps.claim(consumers, config.batch);
    if (!batch.length) return total;
    total += batch.length;
    const run = (claimed: ClaimedRow) =>
      deps.deliver(claimed, { timeoutMs: config.timeoutMs }).catch(() => {
        // The row keeps its lease and runs again after it ends.
        logger.error("Outbox delivery could not record its outcome", {
          id: claimed.row.id,
          consumer: claimed.row.consumer,
        });
      });
    if (config.mode === "parallel") await Promise.all(batch.map(run));
    else for (const claimed of batch) await run(claimed);
  }
  return total;
}

/**
 * A single-flight loop: one run at a time, a poll, and a nudge. A nudge
 * during a run schedules one more run, so a row enqueued after the last
 * claim does not wait for the poll.
 */
export function startLoop(
  run: (isStopped: () => boolean) => Promise<unknown>,
  { pollMs, label }: { pollMs: number; label: string },
) {
  let running: Promise<void> | null = null;
  let again = false;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    // A nudge runs inside the publishing request: detach, or the drain
    // would log and report other workspaces' rows as that request.
    running = runDetached(async () => {
      do {
        again = false;
        try {
          await run(() => stopped);
        } catch (error) {
          // A database outage: no claim committed, so no attempt is spent.
          logger.error(`Outbox ${label} relay failed`, {
            error_code: errorCode(error),
          });
        }
      } while (again && !stopped);
    }).finally(() => {
      running = null;
    });
  };
  const timer = setInterval(tick, pollMs);
  timer.unref();
  const unsubscribe = onOutboxNudge(tick);
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    unsubscribe();
    await running;
  };
}

/**
 * Starts one loop per lane that has consumers. The returned function stops
 * them and waits for in-flight handlers; unfinished rows stay pending and
 * run again after their lease.
 */
export function startOutboxRelay({ pollMs = 1_000 }: { pollMs?: number } = {}) {
  const stops = (Object.keys(LANES) as Lane[])
    .filter((lane) => consumersInLane(lane).length > 0)
    .map((lane) =>
      startLoop((isStopped) => drainLane(lane, defaultDeps, isStopped), {
        pollMs,
        label: lane,
      }),
    );
  return async () => {
    await Promise.all(stops.map((stop) => stop()));
  };
}
