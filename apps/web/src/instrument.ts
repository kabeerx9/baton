import * as Sentry from "@sentry/react";
import {
  failClosed,
  scrubBreadcrumb,
  scrubEvent,
  scrubLog,
  scrubSpan,
} from "@/lib/observability/scrub";
import { resolveSentryConfig } from "@/lib/observability/sentry-config";

// env.sh renders these placeholders at container start; see apps/web/env.awk.
const config = resolveSentryConfig(
  import.meta.env.VITE_SENTRY_DSN,
  import.meta.env.VITE_SENTRY_ENVIRONMENT,
  import.meta.env.MODE,
);

if (config) {
  const scrubEventSafely = failClosed(scrubEvent);
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    // Matches the source map upload in vite.config.ts.
    release: __SENTRY_RELEASE__,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    },
    ignoreErrors: [
      // Thrown by Safari browser extensions on iOS 18+ injecting content scripts;
      // not caused by baton code.
      "Invalid call to runtime.sendMessage()",
      // Thrown by Facebook's in-app browser (Android) navigation performance logger
      // calling postMessage on a destroyed WebView Java bridge; not caused by baton code.
      "Error invoking postMessage: Java object is gone",
    ],
    denyUrls: [
      // Errors from third-party affiliate/adware browser extensions that inject
      // scripts fetching from rsc.cdn77.org (e.g. domainList.json); not caused by baton code.
      /cdn77\.org/,
    ],
    // Safari's "Load failed" used to be filtered here by message alone, which
    // also silenced actionable TanStack Query fetch failures. The query client
    // already rate-limits network errors via its own cooldown; auth-provider
    // tags its transient session-fetch errors so we can drop only those here.
    beforeSend(event) {
      if (event.tags?.area === "auth.session") return null;
      return scrubEventSafely(event);
    },
    // v11 streams spans by default; beforeSendTransaction would never run.
    beforeSendSpan: scrubSpan,
    beforeBreadcrumb: failClosed(scrubBreadcrumb),
    beforeSendLog: failClosed(scrubLog),
    // Router tracing is added in main.tsx once the router exists. Session
    // Replay is off on purpose: its rrweb Meta event records location.href
    // (join and reset tokens) and @sentry/replay 11.9 has no hook to scrub it.
    integrations: [
      // Console warnings and errors become Sentry Logs; info and debug do not.
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
    tracesSampleRate: 0.1,
  });
}
