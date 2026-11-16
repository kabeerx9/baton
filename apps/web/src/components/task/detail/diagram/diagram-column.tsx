import { useTranslation } from "react-i18next";
import type { LinkedTask } from "@/components/board/task-flow/linked";
import { DiagramNode, type NodeRole } from "./diagram-node";
import { MAX_NODES, NODE_GAP } from "./geometry";

export function DiagramColumn({
  heading,
  nodes,
  roleOf,
  side,
  workspaceId,
}: {
  heading: string;
  nodes: LinkedTask[];
  roleOf: (node: LinkedTask) => NodeRole;
  side: "left" | "right";
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const shown = nodes.slice(0, MAX_NODES);
  return (
    <div className="relative w-full min-w-0 md:w-[290px]">
      <h2 className="mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider md:absolute md:-top-7 md:mb-0">
        {heading}
      </h2>
      <ul className="flex flex-col" style={{ gap: NODE_GAP }}>
        {shown.map((n, i) => (
          <li key={n.id}>
            <DiagramNode
              node={n}
              role={roleOf(n)}
              index={i}
              side={side}
              workspaceId={workspaceId}
            />
          </li>
        ))}
      </ul>
      {nodes.length > shown.length && (
        <p className="mt-2 text-muted-foreground text-xs">
          {t("tasks:hero.diagram.more", { count: nodes.length - shown.length })}
        </p>
      )}
    </div>
  );
}
