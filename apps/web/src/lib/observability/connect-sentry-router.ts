import * as Sentry from "@sentry/react";
import { workspaceIdFromMatches } from "./workspace-id-from-matches";

type RouterLike = {
  state: { matches: readonly { params?: Record<string, unknown> }[] };
  subscribe: (event: "onResolved", listener: () => void) => () => void;
};

/**
 * Adds TanStack Router tracing (pageload and navigation spans) and keeps the
 * `workspace_id` tag on the active workspace. Does nothing when Sentry is off.
 */
export function connectSentryRouter(router: RouterLike) {
  if (!Sentry.isInitialized()) return;
  Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router));
  router.subscribe("onResolved", () => {
    Sentry.setTag("workspace_id", workspaceIdFromMatches(router.state.matches));
  });
}
