import type { Linked } from "../../types";
import { RelayGhost } from "./relay-ghost";
import { type NodeRole, RelayNode } from "./relay-node";
import { NODE_GAP } from "./relay-geometry";

export function RelayColumn({
  title,
  nodes,
  extra,
  ghost,
  role,
  align,
}: {
  title: string;
  nodes: Linked[];
  extra: number;
  ghost: string;
  role: NodeRole;
  align: "left" | "right";
}) {
  return (
    <div className="relative w-full min-w-0 md:w-[280px] lg:w-[300px]">
      <h2 className="mb-2 text-[11px] md:absolute md:-top-6 md:mb-0 font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      <ul className="flex flex-col" style={{ gap: NODE_GAP }}>
        {nodes.length === 0 ? (
          <li>
            <RelayGhost text={ghost} />
          </li>
        ) : (
          nodes.map((n, i) => (
            <li key={n.key}>
              <RelayNode node={n} role={role} index={i} align={align} />
            </li>
          ))
        )}
      </ul>
      {extra > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">+{extra} more</p>
      )}
    </div>
  );
}
