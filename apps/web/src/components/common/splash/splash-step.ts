/** What the app is waiting on when nothing can show yet. */
export type SplashStep = "session" | "workspace" | "task" | "generic";

export type SplashLineKey =
  | "common:splash.session"
  | "common:splash.workspace"
  | "common:splash.task"
  | "common:splash.generic";

const LINES: Record<SplashStep, SplashLineKey> = {
  session: "common:splash.session",
  workspace: "common:splash.workspace",
  task: "common:splash.task",
  generic: "common:splash.generic",
};

export function splashLineKey(step: SplashStep): SplashLineKey {
  return LINES[step] ?? LINES.generic;
}

/**
 * The step behind a route that is loading. Only routes whose wait is known get
 * a specific line; anything else says "Loading…".
 */
export function splashStepForPath(pathname: string): SplashStep {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/dashboard" || path.startsWith("/dashboard/workspace/")) {
    return "workspace";
  }
  if (/^\/[^/]+\/task\/[^/]+/.test(path) && !path.startsWith("/dashboard")) {
    return "task";
  }
  return "generic";
}
