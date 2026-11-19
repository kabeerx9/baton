import type { ReactNode } from "react";
import type { BoardTask, Person } from "@/components/board/model";
import { TaskHero } from "../task-hero";
import { FeatureHeadline } from "./feature-headline";
import { FeaturePulse } from "./feature-pulse";
import type { FeatureSummary } from "./feature-status";
import { featureTone } from "./feature-tone";
import { MotionStyles } from "./motion-styles";

/**
 * The hero of a feature. It uses the task hero's shell, with the status ring,
 * the "follows its tasks" box and the generic headline replaced by the Pulse
 * status area and a headline derived from the tasks.
 */
export function FeatureHero({
  feature,
  summary,
  keyLabel,
  repoName,
  title,
  owner,
}: {
  feature: BoardTask;
  summary: FeatureSummary;
  keyLabel: string;
  repoName: string | null;
  title: ReactNode;
  owner: Person | null;
}) {
  return (
    <>
      <MotionStyles />
      <TaskHero
        tone={featureTone(summary)}
        keyLabel={keyLabel}
        repoName={repoName}
        title={title}
        headline={<FeatureHeadline summary={summary} />}
        bar={<FeaturePulse feature={feature} summary={summary} />}
        diagram={null}
        owner={owner}
        signal={null}
      />
    </>
  );
}
