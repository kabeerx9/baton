// Removes secrets and personal data from text before it reaches Sentry.
// Keep in step with apps/web/src/lib/observability/scrub.ts (same rules).

export const FILTERED = "[Filtered]";

const SENSITIVE_PARAMS =
  "t|token|code|state|access_token|refresh_token|id_token|api_key|apikey|key|secret|password|session|session_token|signature|sig";

type Rule = readonly [RegExp, string];

// Order matters: whole-query and path rules run before the generic ones.
const RULES: readonly Rule[] = [
  // Presigned object-storage URLs: the whole query is the credential.
  [
    /(\?)[^\s#"'<>]*(?:X-Amz-|Signature=|X-Goog-Signature)[^\s#"'<>]*/gi,
    `$1${FILTERED}`,
  ],
  // Credentials in the URL authority: https://user:pass@host
  [/(\/\/)[^/\s:@"']+:[^/\s@"']+@/g, `$1${FILTERED}@`],
  [
    new RegExp(`([?&;#](?:${SENSITIVE_PARAMS})=)[^&#\\s"'<>]*`, "gi"),
    `$1${FILTERED}`,
  ],
  // Secrets carried in the path.
  [/(\/join\/)[^/?#\s"'<>]+/gi, `$1${FILTERED}`],
  [/(\/reset-password\/)[^/?#\s"'<>]+/gi, `$1${FILTERED}`],
  [/(hooks\.slack\.com\/)[^\s"'<>]+/gi, `$1${FILTERED}`],
  [/(discord(?:app)?\.com\/api\/webhooks\/)[^\s"'<>]+/gi, `$1${FILTERED}`],
  // Authorization header values and session cookies.
  [/\b(Bearer|Basic)\s+[^\s"',;]+/gi, `$1 ${FILTERED}`],
  [/((?:__Secure-)?[\w.-]*session_token=)[^;\s&"']+/gi, `$1${FILTERED}`],
  [/\bbaton_mcp_[A-Za-z0-9_-]+/g, `baton_mcp_${FILTERED}`],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  // Opaque tokens: API keys (optional prefix + 64 letters), join tokens
  // (43 base64url characters), session tokens. Ids and trace ids are shorter.
  [/(^|[^A-Za-z0-9_-])[A-Za-z0-9_-]{40,}/g, `$1${FILTERED}`],
];

/** Returns `value` with every known secret shape replaced. Never throws. */
export function scrubText(value: string): string {
  let out = value;
  for (const [pattern, replacement] of RULES) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  }
  // Encoded paths (`%2Fjoin%2F<token>`) are scrubbed in their decoded form.
  if (/%[0-9a-f]{2}/i.test(out)) {
    let decoded: string | null = null;
    try {
      decoded = decodeURIComponent(out);
    } catch {
      decoded = null;
    }
    if (decoded !== null && decoded !== out) {
      const scrubbed = scrubText(decoded);
      if (scrubbed !== decoded) return scrubbed;
    }
  }
  return out;
}

const MAX_DEPTH = 8;

// Keys whose value is a secret whatever it looks like.
const SECRET_KEY =
  /^(?:token|access_token|refresh_token|id_token|api_key|apikey|secret|password|session_token|signature|authorization|cookie)$/i;
// Route and query parameters copied into attributes by tracing, such as
// `params.token` or `url.path.parameter.token` for /join/$token.
const SECRET_PARAM_KEY = new RegExp(
  `^(?:params|url\\.path\\.parameter|url\\.query|query)\\.(?:${SENSITIVE_PARAMS})$`,
  "i",
);

function isSecretKey(key: string) {
  return SECRET_KEY.test(key) || SECRET_PARAM_KEY.test(key);
}

/** Scrubs every string inside `value`; values under secret keys are replaced. */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (typeof value === "string") return scrubText(value) as T;
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object")
    return value;
  if (Array.isArray(value))
    return value.map((item) => scrubDeep(item, depth + 1)) as T;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value))
    out[key] = isSecretKey(key) ? FILTERED : scrubDeep(item, depth + 1);
  return out as T;
}

type Breadcrumbish = { message?: string; data?: Record<string, unknown> };

export function scrubBreadcrumb<B extends Breadcrumbish>(crumb: B): B {
  return {
    ...crumb,
    ...(crumb.message !== undefined && { message: scrubText(crumb.message) }),
    ...(crumb.data !== undefined && { data: scrubDeep(crumb.data) }),
  };
}

// Only the fields that carry free text or URLs. Ids, release and SDK
// metadata are left alone so grouping still works.
const EVENT_TEXT_FIELDS = [
  "message",
  "logentry",
  "transaction",
  "request",
  "extra",
  "contexts",
  "spans",
] as const;

type Frameish = {
  filename?: string;
  module?: string;
  abs_path?: string;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
  vars?: Record<string, unknown>;
};

type Stackish = { frames?: Frameish[] };

/**
 * A frame's file can be a page URL (`https://app/join/<token>:1:2`) and its
 * source context can hold literals. Function, line, column and in_app stay
 * as they are, so symbolication and grouping still work.
 */
function scrubFrame<F extends Frameish>(frame: F): F {
  const out: F = { ...frame };
  if (out.filename !== undefined) out.filename = scrubText(out.filename);
  if (out.abs_path !== undefined) out.abs_path = scrubText(out.abs_path);
  // The Node parser names the module after the file: a scrubbed path
  // means the module name came from the secret too.
  if (
    out.module !== undefined &&
    (out.filename !== frame.filename || out.abs_path !== frame.abs_path)
  )
    out.module = FILTERED;
  if (out.context_line !== undefined)
    out.context_line = scrubText(out.context_line);
  if (out.pre_context) out.pre_context = out.pre_context.map(scrubText);
  if (out.post_context) out.post_context = out.post_context.map(scrubText);
  if (out.vars !== undefined) out.vars = scrubDeep(out.vars);
  return out;
}

function scrubStacktrace<S extends Stackish>(stacktrace: S): S {
  return stacktrace.frames
    ? { ...stacktrace, frames: stacktrace.frames.map(scrubFrame) }
    : stacktrace;
}

type Exceptionish = { value?: string; stacktrace?: Stackish };

type Eventish = {
  exception?: { values?: Exceptionish[] };
  threads?: { values?: Array<{ stacktrace?: Stackish }> };
  breadcrumbs?: Breadcrumbish[];
} & Partial<Record<(typeof EVENT_TEXT_FIELDS)[number], unknown>>;

export function scrubEvent<E extends Eventish>(event: E): E {
  const out: E = { ...event };
  for (const field of EVENT_TEXT_FIELDS)
    if (out[field] !== undefined) out[field] = scrubDeep(out[field]);
  if (out.exception?.values)
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) => ({
        ...v,
        ...(v.value !== undefined && { value: scrubText(v.value) }),
        ...(v.stacktrace !== undefined && {
          stacktrace: scrubStacktrace(v.stacktrace),
        }),
      })),
    };
  if (out.threads?.values)
    out.threads = {
      ...out.threads,
      values: out.threads.values.map((t) =>
        t.stacktrace === undefined
          ? t
          : { ...t, stacktrace: scrubStacktrace(t.stacktrace) },
      ),
    };
  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb);
  return out;
}

type Logish = { message: unknown; attributes?: Record<string, unknown> };

export function scrubLog<L extends Logish>(log: L): L {
  return {
    ...log,
    message: scrubDeep(log.message),
    ...(log.attributes !== undefined && {
      attributes: scrubDeep(log.attributes),
    }),
  };
}

/**
 * Wraps a scrubber for a Sentry hook. If scrubbing fails, the item is
 * dropped: an unscrubbed item is the unsafe outcome.
 */
export function failClosed<T>(scrub: (item: T) => T): (item: T) => T | null {
  return (item) => {
    try {
      return scrub(item);
    } catch {
      return null;
    }
  };
}

type Spanish = { name: string; attributes?: Record<string, unknown> };

/**
 * Scrubs a streamed span. Sentry cannot drop a span from beforeSendSpan,
 * so if scrubbing fails the span keeps only its timing and ids.
 */
export function scrubSpan<S extends Spanish>(span: S): S {
  try {
    return {
      ...span,
      name: scrubText(span.name),
      ...(span.attributes !== undefined && {
        attributes: scrubDeep(span.attributes),
      }),
    };
  } catch {
    return { ...span, name: FILTERED, attributes: {} };
  }
}
