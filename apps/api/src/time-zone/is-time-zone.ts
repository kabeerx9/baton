// Area/Location[/Sub]. Rejects abbreviations (IST), offsets (+05:30) and
// lowercase names that Intl alone would accept.
const SHAPE = /^[A-Z][A-Za-z0-9_+-]*(\/[A-Z][A-Za-z0-9_+-]*){1,2}$/;

/** True for an IANA zone name this runtime knows. The value is never canonicalised. */
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
