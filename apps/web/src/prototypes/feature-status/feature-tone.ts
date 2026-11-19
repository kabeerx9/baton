import type { CoreTone } from "@/components/task/detail/diagram/diagram-core";
import { heroTone } from "@/components/task/detail/hero-tone";
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
