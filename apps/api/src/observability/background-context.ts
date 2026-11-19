import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";
import { eventContext } from "../events/context";
import { exitRequestContext, runWithRequestContext } from "./request-context";

/**
 * Runs background work outside any request: no request context, no event
 * initiator, and a new Sentry isolation scope and trace. A relay drain that
 * a request nudges would otherwise carry that request's user and workspace.
 */
export function runDetached<T>(fn: () => T): T {
  // New scopes rather than forks: a fork copies the caller's user and tags.
  // The current scope holds the client, so the new one gets it too.
  const scope = new Sentry.Scope();
  scope.setClient(Sentry.getClient());
  return exitRequestContext(() =>
    eventContext.exit(() =>
      Sentry.withIsolationScope(new Sentry.Scope(), () =>
        Sentry.withScope(scope, () =>
          Sentry.startNewTrace(() => Sentry.withActiveSpan(null, fn)),
        ),
      ),
    ),
  );
}

/**
 * Runs one unit of background work for one workspace: logs and Sentry
 * events carry that workspace and a fresh id, and nothing else.
 */
export function runForWorkspace<T>(workspaceId: string, fn: () => T): T {
  return runDetached(() => {
    Sentry.getIsolationScope().setTag("workspace_id", workspaceId);
    return runWithRequestContext({ requestId: randomUUID(), workspaceId }, fn);
  });
}
