import type { LoadStep } from "./load-view";

// Prototype copy lives here: i18n/en-US.json is off limits for this task.
// Production would move these to static i18n keys.

export const WORKSPACE_NAME = "Live scoring";

export type PageId = "task" | "board";

export const PAGE_LABEL: Record<PageId, string> = {
  task: "Task",
  board: "Board",
};

/** The three real awaited steps behind a cold open of a workspace URL. */
export const SPLASH_STEPS: readonly { pending: string; done: string }[] = [
  { pending: "Checking your session…", done: "Signed in" },
  { pending: "Opening your workspace…", done: "Workspace open" },
  { pending: "Checking your access…", done: "Access confirmed" },
];

export const SPLASH_REASSURE = "Still working on it…";

export function pageLoadingLine(page: PageId): string {
  return page === "task"
    ? `Loading task in ${WORKSPACE_NAME}…`
    : `Loading ${WORKSPACE_NAME} board…`;
}

export const PAGE_REASSURE = "Still loading. Your connection may be slow.";

/** Handoff splash status: one line per real awaited step. */
export const HANDOFF_LINES: readonly string[] = [
  "Signing you in…",
  "Loading your workspace…",
  "Checking your access…",
];

export function splashLine(step: LoadStep): string {
  return HANDOFF_LINES[step] ?? HANDOFF_LINES[0]!;
}
