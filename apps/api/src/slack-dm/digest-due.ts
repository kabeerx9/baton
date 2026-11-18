import type { DigestTime } from "./digest-time";

/** A restart or deploy inside this many minutes after the send time still sends. */
export const DIGEST_CATCH_UP_MINUTES = 60;

const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * The local day (YYYY-MM-DD) whose digest is due at `now` in `timeZone`,
 * else null. Due on a local weekday from the send time for
 * DIGEST_CATCH_UP_MINUTES. A range, never "equals the tick": the first
 * minute after a DST gap is inside it, and a DST overlap gives the same day
 * twice, which the claim turns into one send.
 */
export function digestDueDay(
  now: Date,
  timeZone: string,
  at: DigestTime,
): string | null {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(now)) {
    parts[part.type] = part.value;
  }
  if (!WEEKDAYS.has(parts.weekday ?? "")) return null;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const start = at.hour * 60 + at.minute;
  if (minutes < start || minutes >= start + DIGEST_CATCH_UP_MINUTES) {
    return null;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}
