import type { DemoTaskKey } from "@/fetchers/tour/types";

export const STEP_IDS = [
  "welcome",
  "board-columns",
  "task-card",
  "waits-on",
  "nav-my-tasks",
  "my-tasks-intro",
  "my-tasks-next",
  "nav-board",
  "move-task",
  "unblocked",
  "nav-settings",
  "mcp",
] as const;

export type StepId = (typeof STEP_IDS)[number];

export type StepPage = "board" | "my-tasks" | "agents";

/** The label that tells the user where they are. */
export type Section = "board" | "my-tasks" | "agents";

export type Target =
  | { tour: string }
  | { task: DemoTaskKey }
  /** The control that changes this task's status, wherever it is on screen. */
  | { status: DemoTaskKey };

export type StepDef = {
  /** The page the step lives on. */
  page: StepPage;
  section: Section;
  /** `null` centers the card on a lightly dimmed page. */
  target: Target | null;
  /** Advances only when the demo data says so; Next and Back are hidden. */
  waitsForData: boolean;
  /**
   * The step points at a sidebar link that leaves the page. Next goes there,
   * and so does a click on the link itself.
   */
  leaves: boolean;
};

const step = (
  page: StepPage,
  section: Section,
  target: Target | null,
  extra: Partial<Pick<StepDef, "waitsForData" | "leaves">> = {},
): StepDef => ({
  page,
  section,
  target,
  waitsForData: false,
  leaves: false,
  ...extra,
});

export const STEPS: Record<StepId, StepDef> = {
  welcome: step("board", "board", null),
  "board-columns": step("board", "board", { tour: "board-columns" }),
  "task-card": step("board", "board", { task: "design-review" }),
  "waits-on": step("board", "board", { task: "write-tests" }),
  "nav-my-tasks": step(
    "board",
    "board",
    { tour: "nav-my-tasks" },
    { leaves: true },
  ),
  "my-tasks-intro": step("my-tasks", "my-tasks", null),
  "my-tasks-next": step("my-tasks", "my-tasks", { tour: "my-tasks-hero" }),
  "nav-board": step(
    "my-tasks",
    "my-tasks",
    { tour: "nav-board" },
    { leaves: true },
  ),
  "move-task": step(
    "board",
    "board",
    { status: "api-endpoint" },
    { waitsForData: true },
  ),
  unblocked: step("board", "board", { task: "write-tests" }),
  "nav-settings": step(
    "board",
    "board",
    { tour: "nav-settings" },
    { leaves: true },
  ),
  mcp: step("agents", "agents", null),
};

export const FIRST_STEP: StepId = STEP_IDS[0];
export const LAST_STEP: StepId = STEP_IDS[STEP_IDS.length - 1];

export function nextStep(id: StepId): StepId | null {
  return STEP_IDS[STEP_IDS.indexOf(id) + 1] ?? null;
}

/** The step before, skipping interactive ones (their data would re-advance). */
export function previousStep(id: StepId): StepId | null {
  for (let i = STEP_IDS.indexOf(id) - 1; i >= 0; i--) {
    const candidate = STEP_IDS[i] as StepId;
    if (!STEPS[candidate].waitsForData) return candidate;
  }
  return null;
}

export function stepNumber(id: StepId) {
  return STEP_IDS.indexOf(id) + 1;
}

const taskCard = (id: string) =>
  `[data-tour="task-card"][data-tour-task="${CSS.escape(id)}"]`;

/**
 * Selectors for a step's target, best first. The status step points at the
 * Done option once the menu is open, then at the task page's status bar, then
 * at the card's status button.
 */
export function targetSelectors(
  id: StepId,
  taskIds: Record<DemoTaskKey, string>,
): string[] {
  const target = STEPS[id].target;
  if (!target) return [];
  if ("tour" in target) return [`[data-tour="${target.tour}"]`];
  if ("task" in target) return [taskCard(taskIds[target.task])];
  return [
    '[data-tour="status-done"]',
    '[data-tour="status-bar"]',
    `${taskCard(taskIds[target.status])} [data-tour="status-menu"]`,
  ];
}

/** The first selector: the one a sidebar step listens for clicks on. */
export function targetSelector(
  id: StepId,
  taskIds: Record<DemoTaskKey, string>,
): string | null {
  return targetSelectors(id, taskIds)[0] ?? null;
}

/** The route of one task's own page. */
export function isTaskPage(pathname: string) {
  return /\/task\//.test(pathname);
}
