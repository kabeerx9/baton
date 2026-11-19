import * as Sentry from "@sentry/node";
import type { NodeOptions } from "@sentry/node";
import { redactDatabaseErrors } from "./database-error-event";
import {
  failClosed,
  scrubBreadcrumb,
  scrubEvent,
  scrubLog,
  scrubSpan,
} from "./scrub";

export function parseSampleRate(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0;
}

type SentryEnv = Partial<
  Record<
    | "SENTRY_DSN"
    | "SENTRY_ENVIRONMENT"
    | "SENTRY_RELEASE"
    | "SENTRY_TRACES_SAMPLE_RATE"
    | "SENTRY_PROFILES_SAMPLE_RATE"
    | "NODE_ENV",
    string
  >
>;

/** The parts of Sentry.init that come from the environment. Null keeps Sentry off. */
export function sentryOptionsFromEnv(
  env: SentryEnv,
  appVersion: string | null,
): NodeOptions | null {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return null;
  return {
    dsn,
    environment: env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV || "production",
    // CI bakes the commit SHA into SENTRY_RELEASE; the web upload uses the same.
    release: env.SENTRY_RELEASE?.trim() || appVersion || undefined,
    tracesSampleRate: parseSampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
    profileSessionSampleRate: parseSampleRate(env.SENTRY_PROFILES_SAMPLE_RATE),
    ...privacyOptions,
  };
}

/** Collection limits and scrubbing hooks, shared by every Sentry client we build. */
export const privacyOptions = {
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
  beforeBreadcrumb: failClosed(scrubBreadcrumb),
  // Database errors are rewritten from their error objects first, then
  // every event gets the text scrub. A throw drops the event.
  beforeSend: (event, hint) => {
    try {
      const parser = Sentry.getClient()?.getOptions().stackParser;
      return scrubEvent(redactDatabaseErrors(event, hint, parser));
    } catch {
      return null;
    }
  },
  // v11 streams spans by default; beforeSendTransaction would never run.
  beforeSendSpan: scrubSpan,
  beforeSendLog: failClosed(scrubLog),
} satisfies Partial<NodeOptions>;
