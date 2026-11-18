/** Minutes east of UTC for `zone` at `at`, parsed from `longOffset` ("GMT+05:45" gives 345). */
export function zoneOffsetMinutes(zone: string, at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = name?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return 0; // plain "GMT" is UTC
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

/** "GMT+5:30", "GMT-8", "GMT+0". */
export function formatOffset(minutes: number): string {
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  const sign = minutes < 0 ? "-" : "+";
  return `GMT${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}
