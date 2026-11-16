import type { Linked } from "../../types";
import { MAX_NODES, NODE_GAP } from "../handoff/relay-geometry";
import type { NodeRole } from "../handoff/relay-node";
import { CalmNode } from "./calm-node";

export function CalmColumn({
  heading,
  nodes,
  total,
  role,
  align,
}: {
  heading: string;
  nodes: Linked[];
  total: number;
  role: NodeRole;
  align: "left" | "right";
}) {
  const shown = nodes.slice(0, MAX_NODES);
  return (
    <div className="relative w-full min-w-0 md:w-[290px]">
      <h2 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase md:absolute md:-top-7 md:mb-0">
        {heading}
      </h2>
      <ul className="flex flex-col" style={{ gap: NODE_GAP }}>
        {shown.map((n, i) => (
          <li key={n.key}>
            <CalmNode node={n} role={role} index={i} align={align} />
          </li>
        ))}
      </ul>
      {total > shown.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          +{total - shown.length} more
        </p>
      )}
    </div>
  );
}
