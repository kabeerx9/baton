// Preloaded with `node --import ./dist/instrument.js` (and `tsx --import` in
// dev) so Sentry hooks http, pg and hono before the app imports them. The
// app must not import this file: the bundle would run Sentry.init twice.
import * as Sentry from "@sentry/node";
import { config } from "dotenv-mono";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { readAppVersion } from "./app-version";
import { sentryOptionsFromEnv } from "./observability/sentry-options";
import { isSensitiveOutboundRequest } from "./utils/sensitive-outbound";

// This file runs before the app loads the root .env (database/index.ts),
// so in dev a SENTRY_DSN set only there would leave Sentry off. Production
// takes its environment from App Platform and reads no file.
if (process.env.NODE_ENV !== "production") config();

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
  // Setup check without a public error route: set SENTRY_BOOT_CHECK=true
  // for one deploy and look for this message in Sentry, then remove it.
  if (process.env.SENTRY_BOOT_CHECK === "true")
    Sentry.captureMessage("Baton API Sentry boot check", "info");
}
