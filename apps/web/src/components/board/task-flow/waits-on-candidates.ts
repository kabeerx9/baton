import type { BoardTask, Status } from "../model";

export type WaitsOnCandidate = {
  id: string;
  key: string;
  title: string;
  status: Status;
};

type Node = WaitsOnCandidate & { blockedBy: string[] };

/** Everything that waits on `id`, directly or through other tasks. */
function dependentsOf(nodes: Node[], id: string) {
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const node of nodes) {
      if (node.blockedBy.includes(current ?? "") && !seen.has(node.id)) {
        seen.add(node.id);
        queue.push(node.id);
      }
    }
  }
  return seen;
}

/**
 * Tasks that `selfId` may wait on: every task that stands alone and every task
 * under a feature. A feature is not offered, since its column follows its tasks.
 * A task is left out when it is this task, is already linked, or waits on this
 * task. That last case would make a loop that nothing could finish.
 */
export function waitsOnCandidates(
  boardTasks: BoardTask[],
  selfId: string,
  linked: ReadonlySet<string>,
): WaitsOnCandidate[] {
  const nodes: Node[] = boardTasks.flatMap((t) =>
    t.subtasks.length > 0
      ? t.subtasks.map((s) => ({
          id: s.id,
          key: s.key,
          title: s.title,
          status: s.status,
          blockedBy: s.blockedBy,
        }))
      : [
          {
            id: t.id,
            key: t.key,
            title: t.title,
            status: t.status,
            blockedBy: [],
          },
        ],
  );
  const dependents = dependentsOf(nodes, selfId);
  return nodes
    .filter(
      (n) => n.id !== selfId && !linked.has(n.id) && !dependents.has(n.id),
    )
    .map(({ blockedBy: _blockedBy, ...candidate }) => candidate);
}
