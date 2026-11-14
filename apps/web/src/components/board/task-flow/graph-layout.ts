import dagre from "@dagrejs/dagre";

/** Positions for a small directed graph, from dagre. Returns top-left corners. */
export function layout(
  nodes: { id: string; width: number; height: number }[],
  edges: { source: string; target: string }[],
  direction: "TB" | "LR",
  gap: { rank: number; node: number },
) {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, ranksep: gap.rank, nodesep: gap.node });
  for (const node of nodes) {
    graph.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);
  return new Map(
    nodes.map((node) => {
      const at = graph.node(node.id);
      return [
        node.id,
        { x: at.x - node.width / 2, y: at.y - node.height / 2 },
      ] as const;
    }),
  );
}
