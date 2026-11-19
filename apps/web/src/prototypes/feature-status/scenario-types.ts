import type { BoardTask } from "@/components/board/model";
import type { LinkedTask } from "@/components/board/task-flow/linked";

export const SCENARIO_IDS = [
  "big",
  "small",
  "done",
  "fresh",
  "linked",
  "plain",
] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

/** One page state: the item as the board reads it, and its links to other features. */
export type Scenario = {
  id: ScenarioId;
  label: string;
  feature: BoardTask;
  /** Features this one waits on, as the page's diagram gets them. */
  waitsOn: LinkedTask[];
  /** Features that wait on this one. */
  blocks: LinkedTask[];
};

export function linkedFeature(
  init: Pick<LinkedTask, "key" | "title" | "status" | "owner"> & {
    blocked?: boolean;
  },
): LinkedTask {
  return { id: `id-${init.key}`, projectId: "project-board", ...init };
}
