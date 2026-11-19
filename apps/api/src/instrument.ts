// Preloaded with `node --import ./dist/instrument.js` (and `tsx --import` in
// dev) so Sentry hooks http, pg and hono before the app imports them. The
// app must not import this file: the bundle would run Sentry.init twice.
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { readAppVersion } from "./app-version";
import { sentryOptionsFromEnv } from "./observability/sentry-options";
import { isSensitiveOutboundRequest } from "./utils/sensitive-outbound";

const options = sentryOptionsFromEnv(process.env, readAppVersion());

if (options) {
  Sentry.init({
    ...options,
    profileLifecycle: "trace",
    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration({
        ignoreOutgoingRequests: isSensitiveOutboundRequest,
      }),
      Sentry.nativeNodeFetchIntegration({
        ignoreOutgoingRequests: isSensitiveOutboundRequest,
      }),
      // app.onError reports request errors (observability/report-error.ts);
      // the integration keeps route names and spans but never captures.
      Sentry.honoIntegration({ shouldHandleError: () => false }),
    ],
  });
}
