import type { Priority } from "../../types";

const ORDER: Priority[] = ["none", "low", "medium", "high", "urgent"];

/** The next priority, wrapping from urgent back to none. */
export function nextPriority(p: Priority): Priority {
  return ORDER[(ORDER.indexOf(p) + 1) % ORDER.length] ?? "none";
}
