const SHAPE = /^[A-Z][A-Za-z0-9_+-]*(\/[A-Z][A-Za-z0-9_+-]*){1,2}$/; // Area/Location[/Sub]

/** An IANA zone name the browser knows. Same rule as the API copy in apps/api/src/time-zone. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  if (value !== "UTC" && !SHAPE.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
