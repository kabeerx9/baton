import type { WorkspaceUsage } from "@/constants/onboarding";

export type OnboardingStepId =
  | "workspace"
  | "usage"
  | "project"
  | "invite"
  | "ready";

type StepOptions = {
  usage: WorkspaceUsage;
  canInvite: boolean;
};

export function getOnboardingSteps({
  usage,
  canInvite,
}: StepOptions): OnboardingStepId[] {
  const steps: OnboardingStepId[] = ["workspace", "usage", "project"];
  if (usage === "team" && canInvite) steps.push("invite");
  steps.push("ready");
  return steps;
}

export function getStepProgress(
  steps: OnboardingStepId[],
  current: OnboardingStepId,
) {
  const counted: OnboardingStepId[] = steps.filter((step) => step !== "ready");
  return {
    current: counted.indexOf(current) + 1,
    total: counted.length,
  };
}

export function getNextStep(
  steps: OnboardingStepId[],
  current: OnboardingStepId,
): OnboardingStepId {
  return steps[steps.indexOf(current) + 1] ?? "ready";
}
