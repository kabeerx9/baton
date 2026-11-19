import type { Subtask } from "@/components/board/model";
import { BarLegend } from "./bar-legend";
import { FeatureHero } from "./feature-hero";
import type { FeatureSummary, Held } from "./feature-status";
import { LinkedRows } from "./linked-rows";
import type { Scenario } from "./scenario-types";
import { RollCallGroup } from "./roll-call-group";
import { RollCallRow } from "./roll-call-row";
import { ASKED_TEXT, BLOCKED_TEXT } from "./state-style";

/**
 * Roster. Layout: a list. Every task is a row, grouped by what it needs from
 * someone: attention first, then work in flight, then what waits, then done.
 */
export function VariantRollCall({
  scenario,
  summary,
}: {
  scenario: Scenario;
  summary: FeatureSummary;
}) {
  const { held, free, status } = summary;
  const done = scenario.feature.subtasks.filter((t) => t.status === "done");
  const active = free.filter((t) => t.status !== "todo");
  const waiting = free.filter((t) => t.status === "todo");
  const allDone = status.kind === "done";
  const linked = summary.waitsOn.length + summary.blocks.length;
  const rows = (tasks: Subtask[], heldOf?: Held[]) =>
    tasks.map((task, i) => (
      <RollCallRow
        key={task.id}
        task={task}
        index={i}
        held={heldOf?.find((h) => h.task.id === task.id)}
      />
    ));
  return (
    <FeatureHero
      scenario={scenario}
      summary={summary}
      bar={
        <div className="flex flex-col gap-3">
          <BarLegend summary={summary} />
          <div
            role="group"
            aria-label="Tasks by state"
            className="overflow-hidden rounded-2xl border bg-background/60"
          >
            <RollCallGroup
              title="Needs attention"
              count={held.length}
              tone={
                held.some((h) => h.kind === "blocked")
                  ? BLOCKED_TEXT
                  : ASKED_TEXT
              }
            >
              {rows(
                held.map((h) => h.task),
                held,
              )}
            </RollCallGroup>
            <RollCallGroup title="Moving" count={active.length}>
              {rows(active)}
            </RollCallGroup>
            <RollCallGroup title="Up next" count={waiting.length}>
              {rows(waiting)}
            </RollCallGroup>
            <RollCallGroup
              title="Done"
              count={done.length}
              foldable
              defaultOpen={allDone}
            >
              {rows(done)}
            </RollCallGroup>
            {linked > 0 && (
              <RollCallGroup title="Other features" count={linked}>
                <LinkedRows waitsOn={summary.waitsOn} blocks={summary.blocks} />
              </RollCallGroup>
            )}
          </div>
        </div>
      }
    />
  );
}
