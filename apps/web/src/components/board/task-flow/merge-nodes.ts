import type { Node } from "@xyflow/react";

/**
 * The next set of nodes for a flow, keeping every node that is still there.
 * React Flow stores what it measured and where it was dragged on the node
 * object itself, so a rebuilt node loses both and is hidden until it is
 * measured again. A node keeps its object and only has its data replaced; a
 * new node arrives as given, and a node that is gone is dropped.
 */
export function mergeNodes<N extends Node>(current: N[], next: N[]): N[] {
  const existing = new Map(current.map((node) => [node.id, node]));
  return next.map((node) => {
    const kept = existing.get(node.id);
    return kept ? ({ ...kept, data: node.data } as N) : node;
  });
}
