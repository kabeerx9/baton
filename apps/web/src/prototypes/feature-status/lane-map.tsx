import { useMemo, useRef } from "react";
import type { Blocker } from "@/components/board/model";
import { COLUMN_ORDER, type FeatureSummary } from "./feature-status";
import { LaneColumn } from "./lane-column";
import { LaneEdges } from "./lane-edges";
import { LaneLinkRow } from "./lane-link-row";
import { OutsideNode } from "./lane-node";
import type { Scenario } from "./scenario-types";
import { type NodeEdge, useEdgePaths } from "./use-edge-paths";

/**
 * The map: one column per board column, a node per task, and a line from each
 * blocker to the task it holds up. Blockers from other features sit above.
 */
export function LaneMap({
  scenario,
  summary,
}: {
  scenario: Scenario;
  summary: FeatureSummary;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const { edges, outside } = useMemo(() => {
    const edges: NodeEdge[] = [];
    const outside = new Map<string, Blocker>();
    for (const h of summary.held) {
      if (h.kind !== "blocked") continue;
      for (const b of h.task.waitsOn)
        edges.push({ from: b.key, to: h.task.key });
      for (const b of h.outside) outside.set(b.key, b);
    }
    return { edges, outside: [...outside.values()] };
  }, [summary.held]);
  const shape = useEdgePaths(wrap, edges);

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <LaneLinkRow label="Waits on" items={summary.waitsOn} open />
      <div ref={wrap} className="relative flex flex-col gap-5">
        {outside.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs">
              Held up by other features
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {outside.map((b) => (
                <OutsideNode key={b.key} blocker={b} />
              ))}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-4 gap-1.5">
          {COLUMN_ORDER.map((status) => (
            <LaneColumn
              key={status}
              status={status}
              tasks={scenario.feature.subtasks.filter(
                (t) => t.status === status,
              )}
              held={summary.held}
            />
          ))}
        </div>
        <LaneEdges {...shape} />
      </div>
      <LaneLinkRow label="Holds up" items={summary.blocks} open={false} />
    </div>
  );
}
