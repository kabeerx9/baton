import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Blocker, BoardTask } from "@/components/board/model";
import { COLUMN_ORDER, columnOf, type FeatureSummary } from "./feature-status";
import { LaneColumn } from "./lane-column";
import { LaneEdges } from "./lane-edges";
import { OutsideNode } from "./outside-node";
import { type NodeEdge, useEdgePaths } from "./use-edge-paths";

/**
 * The map: one column per board column, a node per task, and a line from each
 * blocker to the task it holds up. Blockers from other features sit above;
 * tasks elsewhere that wait on ours sit below. The lines are decoration: each
 * held node and outside node states the relationship in text.
 */
export function LaneMap({
  feature,
  summary,
}: {
  feature: BoardTask;
  summary: FeatureSummary;
}) {
  const { t } = useTranslation();
  const wrap = useRef<HTMLDivElement>(null);
  const { edges, above, below } = useMemo(() => {
    const edges: NodeEdge[] = [];
    const above = new Map<string, Blocker>();
    for (const h of summary.held) {
      if (h.kind !== "blocked") continue;
      for (const b of h.task.waitsOn)
        edges.push({ from: b.key, to: h.task.key });
      for (const b of h.outside) above.set(b.key, b);
    }
    const below = new Map<string, Blocker>();
    for (const d of summary.dependents) {
      edges.push({ from: d.from, to: d.to.key });
      below.set(d.to.key, d.to);
    }
    return { edges, above: [...above.values()], below: [...below.values()] };
  }, [summary.held, summary.dependents]);
  const shape = useEdgePaths(wrap, edges);

  return (
    <div ref={wrap} className="relative flex max-w-5xl flex-col gap-5">
      {above.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs">
            {t("tasks:hero.feature.lanes.heldUpBy")}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {above.map((b) => (
              <OutsideNode key={b.key} item={b} />
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {COLUMN_ORDER.map((status) => (
          <LaneColumn
            key={status}
            status={status}
            tasks={feature.subtasks.filter((x) => columnOf(x) === status)}
            held={summary.held}
          />
        ))}
      </div>
      {below.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs">
            {t("tasks:hero.feature.lanes.holdsUp")}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {below.map((b) => (
              <OutsideNode key={b.key} item={b} />
            ))}
          </ul>
        </div>
      )}
      <LaneEdges {...shape} />
    </div>
  );
}
