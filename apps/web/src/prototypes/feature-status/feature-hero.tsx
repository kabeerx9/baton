import type { ReactNode } from "react";
import { TaskHero } from "@/components/task/detail/task-hero";
import { featureHeadline, featureTone } from "./feature-headline";
import type { FeatureSummary } from "./feature-status";
import type { Scenario } from "./scenario-types";

/**
 * The real hero shell for a feature, with the ring, label and bar gone. A
 * variant supplies the status area (`bar`) and the links to other features.
 */
export function FeatureHero({
  scenario,
  summary,
  bar,
  links,
}: {
  scenario: Scenario;
  summary: FeatureSummary;
  bar: ReactNode;
  links?: ReactNode;
}) {
  const { feature } = scenario;
  return (
    <TaskHero
      tone={featureTone(summary)}
      keyLabel={`${feature.key} · Feature`}
      repoName={null}
      title={
        <h1 className="text-balance font-semibold text-2xl tracking-tight sm:text-3xl">
          {feature.title}
        </h1>
      }
      headline={featureHeadline(summary)}
      bar={bar}
      diagram={links ?? null}
      owner={feature.assignee}
      signal={null}
    />
  );
}
