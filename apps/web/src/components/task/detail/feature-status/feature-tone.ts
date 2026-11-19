import type { CoreTone } from "../diagram/diagram-core";
import { heroTone } from "../hero-tone";
import type { FeatureSummary } from "./feature-status";

/** The hero's one accent, from the same rule the task page uses. */
export function featureTone(summary: FeatureSummary): CoreTone {
  const { status, counts, total } = summary;
  return heroTone({
    unknown: status.kind === "empty",
    done: status.kind === "done",
    pendingRequest: status.kind === "asking",
    blocked: status.kind === "stuck" || summary.waitsOn.length > 0,
    started: counts.todo < total,
  });
}
