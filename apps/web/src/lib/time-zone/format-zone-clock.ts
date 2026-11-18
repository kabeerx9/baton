/** "3:42 PM" in `zone`. */
export function clockText(zone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
}

/** "Wed, Nov 18" in `zone`. */
export function dayText(zone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now);
}
