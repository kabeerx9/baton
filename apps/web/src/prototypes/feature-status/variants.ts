import type { ComponentType } from "react";
import type { FeatureSummary } from "./feature-status";
import type { Scenario } from "./scenario-types";
import { VariantLanes } from "./variant-lanes";
import { VariantPulse } from "./variant-pulse";
import { VariantRollCall } from "./variant-roll-call";

export type VariantProps = { scenario: Scenario; summary: FeatureSummary };

/** Picker order. The key is the number the picker shows. */
export const VARIANTS: {
  name: string;
  Component: ComponentType<VariantProps>;
}[] = [
  { name: "Pulse", Component: VariantPulse },
  { name: "Roster", Component: VariantRollCall },
  { name: "Lanes", Component: VariantLanes },
];
