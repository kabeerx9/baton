import { TaskHero } from "@/components/task/detail/task-hero";
import { DiagramCore } from "@/components/task/detail/diagram/diagram-core";
import { TaskDiagram } from "@/components/task/detail/diagram/task-diagram";
import { StatusBarView } from "@/components/task/detail/status-bar/status-bar-view";
import {
  deriveStatusBar,
  type StatusColumn,
} from "@/components/task/detail/status-bar/status-bar-model";
import type { Scenario } from "./scenario-types";

const COLUMNS: StatusColumn[] = [
  ["to-do", "To do", false],
  ["in-progress", "In progress", false],
  ["in-review", "In review", false],
  ["done", "Done", true],
].map(([slug, name, isFinal], position) => ({
  id: `col-${slug}`,
  slug: slug as string,
  name: name as string,
  position,
  isFinal: Boolean(isFinal),
}));

/**
 * Today's hero for a task with nothing under it. The variants do not touch it:
 * this scenario only shows that the plain case stays as it is.
 */
export function PlainTaskHero({ scenario }: { scenario: Scenario }) {
  const { feature } = scenario;
  const bar = deriveStatusBar({
    columns: COLUMNS,
    status: "in-progress",
    blocked: false,
    loading: false,
    failed: false,
  });
  return (
    <TaskHero
      tone="blue"
      keyLabel={`${feature.key} · Task`}
      repoName="web"
      title={
        <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">
          {feature.title}
        </h1>
      }
      headline="Kabeer is on it."
      bar={<StatusBarView state={bar} pending={false} onChoose={() => {}} />}
      diagram={
        <TaskDiagram
          waitsOn={[]}
          blocks={scenario.blocks}
          done={false}
          stillNeeded={false}
          workspaceId="prototype"
          core={
            <DiagramCore
              label="In progress"
              glyph="doing"
              progress={1 / 3}
              tone="blue"
            />
          }
        />
      }
      owner={feature.assignee}
      signal={null}
    />
  );
}
