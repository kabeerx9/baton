import { isTimeZone } from "./is-time-zone";

/** The device's zone, or null when the browser cannot say or names an invalid one. */
export function detectTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isTimeZone(zone) ? zone : null;
  } catch {
    return null;
  }
}
