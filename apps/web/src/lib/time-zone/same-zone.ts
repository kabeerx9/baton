import { zoneOffsetMinutes } from "./zone-offset";

const DAY_MS = 86_400_000;

/**
 * True when both zones show the same clock now and every 30 days for a year.
 * It makes Asia/Calcutta equal Asia/Kolkata on every engine and ignores a move
 * that does not change the clock (Berlin to Paris). Never compare zone strings.
 * A zone this browser does not know gives true, so a prompt stays hidden.
 */
export function sameZone(a: string, b: string, now: Date): boolean {
  try {
    for (let k = 0; k <= 12; k += 1) {
      const at = new Date(now.getTime() + k * 30 * DAY_MS);
      if (zoneOffsetMinutes(a, at) !== zoneOffsetMinutes(b, at)) return false;
    }
    return true;
  } catch {
    return true;
  }
}
