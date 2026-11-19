/** What browser Sentry needs from the runtime-rendered environment. */
export type SentryRuntimeConfig = { dsn: string; environment: string };

// The image renders BATON_* placeholders at startup (apps/web/env.awk). A
// value that still starts with the prefix was never rendered.
const isPlaceholder = (value: string) => value.startsWith("BATON_");

// https only, except a local fake ingest for development smoke tests.
function isAllowedDsn(dsn: string) {
  try {
    const url = new URL(dsn);
    if (url.protocol === "https:") return true;
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

/** Null keeps Sentry off: no DSN, an unrendered placeholder, or not https. */
export function resolveSentryConfig(
  dsn: string | undefined,
  environment: string | undefined,
  fallbackEnvironment: string,
): SentryRuntimeConfig | null {
  const cleanDsn = dsn?.trim() ?? "";
  if (!cleanDsn || isPlaceholder(cleanDsn)) return null;
  if (!isAllowedDsn(cleanDsn)) return null;
  const cleanEnvironment = environment?.trim() ?? "";
  return {
    dsn: cleanDsn,
    environment:
      cleanEnvironment && !isPlaceholder(cleanEnvironment)
        ? cleanEnvironment
        : fallbackEnvironment,
  };
}
