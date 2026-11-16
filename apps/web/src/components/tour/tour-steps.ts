import type { DemoTaskKey } from "@/fetchers/tour/types";

export const STEP_IDS = [
  "board",
  "demo-tasks",
  "my-tasks",
  "move-task",
  "unblocked",
  "mcp",
] as const;

export type StepId = (typeof STEP_IDS)[number];

export type StepPage = "board" | "my-tasks" | null;

export type StepDef = {
  /** The page the step lives on. `null` keeps the user where they are. */
  page: StepPage;
  /** A stable `data-tour` value, or a demo task the step points at. */
  target: { tour: string } | { task: DemoTaskKey } | null;
  /** Advances only when the demo data says so; Next is hidden. */
  waitsForData: boolean;
};

export const STEPS: Record<StepId, StepDef> = {
  board: { page: "board", target: { tour: "board" }, waitsForData: false },
  "demo-tasks": {
    page: "board",
    target: { tour: "board-columns" },
    waitsForData: false,
  },
  "my-tasks": {
    page: "my-tasks",
    target: { tour: "my-tasks" },
    waitsForData: false,
  },
  "move-task": {
    page: "board",
    target: { task: "api-endpoint" },
    waitsForData: true,
  },
  unblocked: {
    page: "board",
    target: { task: "write-tests" },
    waitsForData: false,
  },
  mcp: { page: null, target: null, waitsForData: false },
};

export const FIRST_STEP: StepId = STEP_IDS[0];
export const LAST_STEP: StepId = STEP_IDS[STEP_IDS.length - 1];

export function nextStep(step: StepId): StepId | null {
  return STEP_IDS[STEP_IDS.indexOf(step) + 1] ?? null;
}

export function stepNumber(step: StepId) {
  return STEP_IDS.indexOf(step) + 1;
}

/** The CSS selector for a step's target. `taskIds` maps demo keys to ids. */
export function targetSelector(
  step: StepId,
  taskIds: Record<DemoTaskKey, string>,
): string | null {
  const target = STEPS[step].target;
  if (!target) return null;
  if ("tour" in target) return `[data-tour="${target.tour}"]`;
  const id = taskIds[target.task];
  return `[data-tour="task-card"][data-tour-task="${CSS.escape(id)}"]`;
}
