import * as Sentry from "@sentry/node";
import type { MiddlewareHandler } from "hono";
import { routePath } from "hono/route";
import { type Logger, logger as defaultLogger } from "./logger";
import { type RequestContext, runWithRequestContext } from "./request-context";
import { acceptRequestId } from "./request-id";

const PROBE_PATHS = new Set(["/api/health", "/health"]);

export function accessLogLevel(status: number) {
  return status >= 500 ? "error" : "info";
}

/**
 * Outermost middleware. Gives each request its own Sentry isolation scope
 * and log context (request id, later workspace and user), returns the id in
 * X-Request-Id, and writes one access log line when the response is ready.
 */
export function requestContext(log: Logger = defaultLogger): MiddlewareHandler {
  return (c, next) => {
    const requestId = acceptRequestId(c.req.header("x-request-id"));
    const context: RequestContext = { requestId };
    const started = performance.now();
    return Sentry.withIsolationScope(async (scope) => {
      scope.setTag("request_id", requestId);
      await runWithRequestContext(context, next);
      try {
        c.res.headers.set("X-Request-Id", requestId);
      } catch {
        // Some passthrough responses have immutable headers.
      }
      if (PROBE_PATHS.has(c.req.path)) return;
      const status = c.res.status;
      runWithRequestContext(context, () =>
        log[accessLogLevel(status)](
          "request",
          {
            method: c.req.method,
            route: routePath(c),
            status,
            duration_ms: Math.round((performance.now() - started) * 10) / 10,
          },
          { sentry: false },
        ),
      );
    });
  };
}
