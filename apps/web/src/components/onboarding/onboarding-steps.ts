export type OnboardingStepId =
  | "start"
  | "workspace"
  | "usage"
  | "project"
  | "ready";

export const ONBOARDING_STEPS: readonly OnboardingStepId[] = [
  "start",
  "workspace",
  "usage",
  "project",
  "ready",
];

/** The fork and the summary are not counted: only the three setup steps are. */
const UNCOUNTED: readonly OnboardingStepId[] = ["start", "ready"];

export function getStepProgress(current: OnboardingStepId) {
  const counted = ONBOARDING_STEPS.filter((step) => !UNCOUNTED.includes(step));
  const index = counted.indexOf(current);
  if (index < 0) return null;
  return { current: index + 1, total: counted.length };
}

export function getNextStep(current: OnboardingStepId): OnboardingStepId {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(current) + 1] ?? "ready";
}
