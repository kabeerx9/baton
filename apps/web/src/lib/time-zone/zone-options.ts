import { formatOffset, zoneOffsetMinutes } from "./zone-offset";

export type ZoneOption = {
  /** The name Intl gave. Stored exactly as is: never canonicalise. */
  value: string;
  /** "(GMT+5:30) Asia/Kolkata", underscores shown as spaces. */
  label: string;
  offset: number;
};

// Chromium lists legacy names (Asia/Calcutta). People read and search the modern
// ones, so labels show those; the legacy name still matches a search.
const MODERN_NAME: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Godthab": "America/Nuuk",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Africa/Asmera": "Africa/Asmara",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
};
const LEGACY_NAME = Object.fromEntries(
  Object.entries(MODERN_NAME).map(([legacy, modern]) => [modern, legacy]),
);

/** The zone name as people write it: modern spelling, spaces for underscores. */
export function displayZone(zone: string): string {
  return (MODERN_NAME[zone] ?? zone).replaceAll("_", " ");
}

function buildOption(value: string, now: Date): ZoneOption {
  const offset = zoneOffsetMinutes(value, now);
  return {
    value,
    offset,
    label: `(${formatOffset(offset)}) ${displayZone(value)}`,
  };
}

function resolvedName(zone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/**
 * Every zone the browser lists, plus UTC, sorted by offset then name. When
 * `current` is not in the list, the entry the browser treats as the same zone
 * stands in for it; if none does, `current` is appended.
 */
export function zoneOptions(current: string | null, now: Date): ZoneOption[] {
  const names = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);
  const options = [...names]
    .map((name) => buildOption(name, now))
    .sort((a, b) => a.offset - b.offset || a.value.localeCompare(b.value));
  if (current && !names.has(current)) {
    const resolved = resolvedName(current);
    if (!resolved || !names.has(resolved)) {
      try {
        options.push(buildOption(current, now));
      } catch {
        // The browser cannot format it. Keep it selectable, without an offset.
        options.push({
          value: current,
          label: displayZone(current),
          offset: 0,
        });
      }
    }
  }
  return options;
}

/** The option value that stands for `current` in `options`, or null. */
export function selectedValue(
  options: readonly ZoneOption[],
  current: string | null,
): string | null {
  if (!current) return null;
  if (options.some((option) => option.value === current)) return current;
  const resolved = resolvedName(current);
  return options.find((option) => option.value === resolved)?.value ?? null;
}

/** Case-insensitive match on the label, the stored value or the legacy name. */
export function matchesZone(option: ZoneOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const modern = MODERN_NAME[option.value] ?? option.value;
  const haystack = [option.label, option.value, LEGACY_NAME[modern] ?? ""]
    .join("\n")
    .replaceAll("_", " ")
    .toLowerCase();
  return haystack.includes(needle.replaceAll("_", " "));
}
