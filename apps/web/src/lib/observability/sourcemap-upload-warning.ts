/**
 * The one CI log line for a failed source map upload. The build goes on:
 * a Sentry outage or an expired token must never block shipping the app.
 * The token is removed from the reason in case an error message echoes it.
 */
export function sourcemapUploadWarning(
  error: unknown,
  token: string | undefined,
) {
  const raw = error instanceof Error ? error.message : String(error);
  const reason = (token ? raw.split(token).join("[Filtered]") : raw)
    .replace(/\s+/g, " ")
    .trim();
  return `SENTRY SOURCEMAP UPLOAD FAILED: ${reason || "unknown error"}`;
}
