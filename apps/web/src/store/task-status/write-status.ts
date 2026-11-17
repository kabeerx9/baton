import type { QueryClient } from "@tanstack/react-query";
import i18n from "i18next";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { HttpError } from "@/lib/http-error";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { notifyChangeRequested } from "@/lib/notify-change-requested";
import { isPerTaskRelationQuery } from "@/lib/relation-query-keys";
import { dispatchStatus, useTaskStatusStore } from "./store";
import type { Move, StatusOutcome, Step, Target } from "./types";
import { type Waiter, type Waiters, waiters } from "./waiters";

/** The deadline on one PUT. After it the write may still have committed. */
export const STATUS_TIMEOUT_MS = 15_000;

const same = (a: Target, b: Target) =>
  a.status === b.status && a.isFinal === b.isFinal;

function settle(list: Waiter[], outcome: StatusOutcome) {
  for (const waiter of list) waiter.resolve(outcome);
}

/**
 * A click on any status control. Resolves with how this click ended:
 * "applied", "requested", or "superseded" (replaced before it was sent, or
 * cancelled, or ignored). Rejects only when this click was the latest intent
 * and the write failed, so a caller's own toast shows once.
 */
export function chooseStatus(args: ChooseArgs): Promise<StatusResult> {
  return choose(args).then((outcome) => ({ outcome }));
}

/** What a status mutation resolves with. Readers test `outcome === "applied"`. */
export type StatusResult = { outcome: StatusOutcome };

type ChooseArgs = {
  queryClient: QueryClient;
  taskId: string;
  target: Target;
  move: Move;
  /** Names the task in the request modal. */
  title?: string;
};

function choose(args: ChooseArgs): Promise<StatusOutcome> {
  const { queryClient, taskId, target, move, title } = args;
  return new Promise((resolve, reject) => {
    const me: Waiter = { resolve, reject };
    const { prev, step } = dispatchStatus(
      taskId,
      { type: "chosen", target, move },
      title,
    );
    const next = step.entry;
    const chain = waiters.get(taskId);

    if (step.send) {
      // A new chain: PUT now.
      waiters.set(taskId, { current: [me], queued: [] });
      void run(queryClient, taskId, step);
      return;
    }
    if (
      chain &&
      prev.kind === "sending" &&
      next.kind === "sending" &&
      next !== prev
    ) {
      // A newer click replaces the one waiting behind the PUT in flight.
      settle(chain.queued, "superseded");
      if (same(next.latest, next.inFlight)) {
        chain.queued = [];
        chain.current.push(me);
      } else {
        chain.queued = [me];
      }
      return;
    }
    if (next.kind === "confirming" && prev.kind !== "confirming") {
      waiters.set(taskId, { current: [me], queued: [] });
      return;
    }
    if (chain && (prev.kind === "confirming" || prev.kind === "asking")) {
      // Another control already holds the modal or the request: share its end.
      chain.current.push(me);
      return;
    }
    // Denied, locked, or not a "apply" move while a PUT is in flight.
    resolve("superseded");
  });
}

/** The modal's confirm: every waiting request goes out, one PUT per task. */
export function confirmRequests(queryClient: QueryClient) {
  for (const taskId of confirmingIds()) {
    const { step } = dispatchStatus(taskId, { type: "confirm" });
    if (step.send) void run(queryClient, taskId, step);
  }
}

/** The modal's cancel: nothing is sent, and every waiting caller settles. */
export function dismissRequests() {
  for (const taskId of confirmingIds()) {
    dispatchStatus(taskId, { type: "dismiss" });
    const chain = waiters.get(taskId);
    waiters.delete(taskId);
    if (chain) settle(chain.current, "superseded");
  }
}

function confirmingIds() {
  const { entries } = useTaskStatusStore.getState();
  return Object.keys(entries).filter(
    (id) => entries[id]?.kind === "confirming",
  );
}

/** One chain: PUT, then report the answer to the entry, until nothing is left to send. */
async function run(queryClient: QueryClient, taskId: string, first: Step) {
  let step: Step | undefined = first;
  while (step?.send) {
    const chain = waiters.get(taskId);
    if (!chain) return;
    step = await sendOnce(queryClient, taskId, step.send, chain);
  }
  waiters.delete(taskId);
  invalidateAfterChain(queryClient, taskId);
}

async function sendOnce(
  queryClient: QueryClient,
  taskId: string,
  target: Target,
  chain: Waiters,
): Promise<Step | undefined> {
  let result: Awaited<ReturnType<typeof updateTaskStatus>>;
  try {
    result = await updateTaskStatus(
      taskId,
      { status: target.status },
      AbortSignal.timeout(STATUS_TIMEOUT_MS),
    );
  } catch (error) {
    return fail(queryClient, taskId, error, chain);
  }

  if (result.outcome === "requested") {
    const { step } = dispatchStatus(taskId, { type: "requested" });
    settle(chain.current, "requested");
    settle(chain.queued, "superseded");
    notifyChangeRequested(queryClient, result.task);
    return step;
  }

  const { step } = dispatchStatus(taskId, {
    type: "applied",
    generation: result.task.statusGeneration,
  });
  settle(chain.current, "applied");
  chain.current = chain.queued;
  chain.queued = [];
  return step;
}

/** 4xx: nothing was written. Anything else: the write may have committed. */
function fail(
  queryClient: QueryClient,
  taskId: string,
  error: unknown,
  chain: Waiters,
): Step | undefined {
  if (error instanceof HttpError && error.status < 500) {
    const { step } = dispatchStatus(taskId, { type: "refused" });
    if (step.send) {
      // A newer target goes next: this failure is not the latest intent.
      settle(chain.current, "superseded");
      chain.current = chain.queued;
      chain.queued = [];
    } else {
      for (const waiter of chain.current) waiter.reject(error);
    }
    return step;
  }

  dispatchStatus(taskId, { type: "unknown", at: Date.now() });
  // A timeout's own message ("signal timed out") says nothing to a person.
  const timedOut = (error as { name?: string } | null)?.name === "TimeoutError";
  const message =
    error instanceof Error && !timedOut
      ? error
      : new Error(
          i18n.t("tasks:popover.status.updateError", {
            defaultValue: "Could not change the status.",
          }),
        );
  for (const waiter of chain.current) waiter.reject(message);
  settle(chain.queued, "superseded");
  // No resend. Read the task now; a successful read of it unlocks the controls.
  void queryClient.refetchQueries({ queryKey: ["task", taskId] });
  return undefined;
}

/** After a chain settles: every view that shows this status refetches, once. */
function invalidateAfterChain(queryClient: QueryClient, taskId: string) {
  invalidateMyWork(queryClient);
  for (const queryKey of [
    ["task", taskId],
    ["tasks"],
    ["task-board"],
    ["notifications"],
    ["projects"],
    ["activities", taskId],
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
  // Per-task relation responses embed the linked tasks' status and assignee.
  void queryClient.invalidateQueries({ predicate: isPerTaskRelationQuery });
}
