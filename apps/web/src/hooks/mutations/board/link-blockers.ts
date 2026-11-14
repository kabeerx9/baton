import createTaskRelation from "@/fetchers/task-relation/create-task-relation";

/**
 * Makes `taskId` wait on each blocker: one "blocks" relation per blocker, with
 * the blocker as the source. Every link is tried, and none is kept locally, so
 * a link the server rejects leaves nothing behind. `message` is the server's
 * text for the first rejection.
 */
export async function linkBlockers(taskId: string, blockerIds: string[]) {
  const results = await Promise.allSettled(
    blockerIds.map((blockerId) =>
      createTaskRelation({
        sourceTaskId: blockerId,
        targetTaskId: taskId,
        relationType: "blocks",
      }),
    ),
  );
  const rejected = results.flatMap((r) =>
    r.status === "rejected" ? [r.reason as unknown] : [],
  );
  const first = rejected[0];
  return {
    failed: rejected.length,
    message: first instanceof Error && first.message ? first.message : null,
  };
}
