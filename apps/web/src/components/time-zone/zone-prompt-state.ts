import { sameZone } from "@/lib/time-zone/same-zone";

// Settings pages keep the corner free: Profile has its own time zone row,
// and the card covered page actions such as Delete workspace.
const SETTINGS_PATH = "/dashboard/settings";

/** What the time-zone prompt shows. One union, one pure derive. */
export type ZonePrompt =
  | { kind: "hidden" }
  | { kind: "unset"; detected: string } // stored zone is null
  | { kind: "mismatch"; stored: string; detected: string }; // device differs from the stored zone

export function deriveZonePrompt(input: {
  /** undefined: not loaded, or the query failed. */
  stored: string | null | undefined;
  detected: string | null;
  dismissedFor: string | null;
  tourCompleted: boolean | undefined;
  pathname: string;
  now: Date;
}): ZonePrompt {
  const { stored, detected, dismissedFor, tourCompleted, pathname, now } =
    input;
  // Every unknown is hidden.
  if (stored === undefined || detected === null) return { kind: "hidden" };
  if (tourCompleted !== true) return { kind: "hidden" };
  if (!pathname.startsWith("/dashboard/")) return { kind: "hidden" };
  if (pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`)) {
    return { kind: "hidden" };
  }
  if (dismissedFor === detected) return { kind: "hidden" };
  if (stored === null) return { kind: "unset", detected };
  if (!sameZone(stored, detected, now)) {
    return { kind: "mismatch", stored, detected };
  }
  return { kind: "hidden" };
}
